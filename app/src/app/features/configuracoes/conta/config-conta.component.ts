import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { LucideLock } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { Conta } from '../../../core/models/conta.models';
import { AuthService } from '../../../core/services/auth.service';
import { ContaService } from '../../../core/services/conta.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExclusaoContaComponent } from './exclusao-conta/exclusao-conta.component';
import { TrocaEmailComponent } from './troca-email/troca-email.component';
import { TrocaSenhaComponent } from './troca-senha/troca-senha.component';

type Painel = 'email' | 'senha' | 'exclusao' | null;

@Component({
  selector: 'app-config-conta',
  standalone: true,
  imports: [LucideLock, TrocaEmailComponent, TrocaSenhaComponent, ExclusaoContaComponent],
  templateUrl: './config-conta.component.html',
})
export class ConfigContaComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly contaService = inject(ContaService);
  private readonly toast = inject(ToastService);

  conta = signal<Conta | null>(null);
  carregando = signal(true);
  erro = signal('');
  painel = signal<Painel>(null);
  encerrando = signal(false);
  baixando = signal(false);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set('');
    this.contaService
      .resumo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (conta) => {
          this.conta.set(conta);
          this.carregando.set(false);
          // um pedido aberto (a página recarregou no meio) já volta no código
          if (conta.trocaDeEmail) this.painel.set('email');
        },
        error: (falha) => {
          this.erro.set(mensagemDeErro(falha));
          this.carregando.set(false);
        },
      });
  }

  abrir(painel: Painel): void {
    this.painel.set(painel);
  }

  fecharPainel(): void {
    this.painel.set(null);
    this.conta.update((c) => c && { ...c, trocaDeEmail: null });
  }

  emailTrocado(email: string): void {
    this.conta.update((c) => c && { ...c, email, sessoes: 1, trocaDeEmail: null });
    this.painel.set(null);
    this.toast.sucesso('E-mail trocado', {
      detalhe: 'Avisamos o endereço antigo e encerramos as outras sessões.',
      chave: 'conta',
    });
  }

  senhaTrocada(): void {
    this.conta.update((c) => c && { ...c, sessoes: 1 });
    this.painel.set(null);
    this.toast.sucesso('Senha trocada', { detalhe: 'As outras sessões foram encerradas.', chave: 'conta' });
  }

  encerrarOutras(): void {
    if (this.encerrando()) return;
    this.encerrando.set(true);
    this.contaService
      .encerrarOutrasSessoes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.encerrando.set(false);
          this.conta.update((c) => c && { ...c, sessoes: 1 });
        },
        error: (falha) => {
          this.encerrando.set(false);
          this.toast.erro('Não encerramos as outras sessões', { detalhe: mensagemDeErro(falha), chave: 'conta' });
        },
      });
  }

  baixarDados(): void {
    if (this.baixando()) return;
    this.baixando.set(true);
    this.contaService
      .exportar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dados) => {
          this.baixando.set(false);
          const arquivo = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(arquivo);
          link.download = `prisma-${this.auth.usuario()?.username ?? 'dados'}.json`;
          link.click();
          // revogar no mesmo tick cancela o download no Firefox
          setTimeout(() => URL.revokeObjectURL(link.href));
        },
        error: (falha) => {
          this.baixando.set(false);
          this.toast.erro('Não baixamos seus dados', { detalhe: mensagemDeErro(falha), chave: 'conta' });
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
