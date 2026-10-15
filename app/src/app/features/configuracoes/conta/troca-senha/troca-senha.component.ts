import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, EventEmitter, OnDestroy, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideEye, LucideEyeOff, LucideInfo } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../../core/errors/mensagens';
import { ContaService } from '../../../../core/services/conta.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Campos } from '../../../../core/validacao/campos';
import { validarSenhaDigitada, validarSenhaNova } from '../../../../core/validacao/conta';

type Campo = 'atual' | 'nova';

@Component({
  selector: 'app-troca-senha',
  standalone: true,
  imports: [FormsModule, LucideEye, LucideEyeOff, LucideInfo],
  templateUrl: './troca-senha.component.html',
})
export class TrocaSenhaComponent implements AfterViewInit, OnDestroy {
  private readonly conta = inject(ContaService);
  private readonly toast = inject(ToastService);

  @Output() trocou = new EventEmitter<void>();
  @Output() fechou = new EventEmitter<void>();

  atual = signal('');
  nova = signal('');
  verAtual = signal(false);
  verNova = signal(false);
  enviando = signal(false);

  readonly campos = new Campos<Campo>(() => ({
    atual: validarSenhaDigitada(this.atual()),
    nova: this.validarNova(),
  }));

  private destroy$ = new Subject<void>();

  ngAfterViewInit(): void {
    queueMicrotask(() => document.getElementById('senha-atual')?.focus());
  }

  editar(campo: Campo, valor: string): void {
    (campo === 'atual' ? this.atual : this.nova).set(valor);
    this.campos.editou(campo);
  }

  trocar(): void {
    if (this.enviando()) return;

    const invalido = this.campos.primeiroInvalido();
    if (invalido) {
      document.getElementById(`senha-${invalido}`)?.focus();
      return;
    }

    this.enviando.set(true);
    this.conta
      .trocarSenha(this.atual(), this.nova())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.trocou.emit();
        },
        error: (falha) => {
          this.enviando.set(false);
          const status = falha instanceof HttpErrorResponse ? falha.status : -1;
          if (status === 403) {
            this.campos.recusar('atual', 'Senha incorreta.');
            document.getElementById('senha-atual')?.focus();
          } else if (status === 400) {
            this.campos.recusar('nova', 'Use de 8 a 128 caracteres, diferente da atual.');
            document.getElementById('senha-nova')?.focus();
          } else {
            this.toast.erro('Não trocamos sua senha', { detalhe: mensagemDeErro(falha), chave: 'troca-senha' });
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private validarNova(): string {
    const erro = validarSenhaNova(this.nova());
    if (erro) return erro;
    return this.nova() === this.atual() ? 'A senha nova precisa ser diferente da atual.' : '';
  }
}
