import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, EventEmitter, OnDestroy, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../../core/errors/mensagens';
import { ContaService } from '../../../../core/services/conta.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Campos } from '../../../../core/validacao/campos';
import { validarSenhaDigitada } from '../../../../core/validacao/conta';

@Component({
  selector: 'app-exclusao-conta',
  standalone: true,
  imports: [FormsModule, LucideEye, LucideEyeOff],
  templateUrl: './exclusao-conta.component.html',
})
export class ExclusaoContaComponent implements AfterViewInit, OnDestroy {
  private readonly conta = inject(ContaService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  @Output() fechou = new EventEmitter<void>();

  senha = signal('');
  verSenha = signal(false);
  enviando = signal(false);

  readonly campos = new Campos<'senha'>(() => ({ senha: validarSenhaDigitada(this.senha()) }));

  private destroy$ = new Subject<void>();

  ngAfterViewInit(): void {
    queueMicrotask(() => document.getElementById('exclusao-senha')?.focus());
  }

  editar(valor: string): void {
    this.senha.set(valor);
    this.campos.editou('senha');
  }

  excluir(): void {
    if (this.enviando()) return;
    if (this.campos.primeiroInvalido()) {
      document.getElementById('exclusao-senha')?.focus();
      return;
    }

    this.enviando.set(true);
    this.conta
      .excluir(this.senha())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.router.navigate(['/']);
          this.toast.sucesso('Conta excluída', { detalhe: 'Apagamos seu perfil e tudo que você registrou.', chave: 'conta' });
        },
        error: (falha) => {
          this.enviando.set(false);
          if (falha instanceof HttpErrorResponse && falha.status === 403) {
            this.campos.recusar('senha', 'Senha incorreta.');
            document.getElementById('exclusao-senha')?.focus();
          } else {
            this.toast.erro('Não excluímos sua conta', { detalhe: mensagemDeErro(falha), chave: 'conta' });
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
