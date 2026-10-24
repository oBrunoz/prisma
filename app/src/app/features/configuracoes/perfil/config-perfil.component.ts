import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { camposRecusados, ehFalhaDeSistema, mensagemDeErro } from '../../../core/errors/mensagens';
import { AtualizacaoPerfil } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Campos } from '../../../core/validacao/campos';
import { validarNome } from '../../../core/validacao/conta';
import { CampoFotoComponent } from './campo-foto/campo-foto.component';
import { EscolherCapaComponent } from './escolher-capa/escolher-capa.component';

type Campo = 'name' | 'bio';

@Component({
  selector: 'app-config-perfil',
  standalone: true,
  imports: [FormsModule, CampoFotoComponent, EscolherCapaComponent],
  templateUrl: './config-perfil.component.html',
})
export class ConfigPerfilComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly salvo = computed(() => {
    const u = this.auth.usuario();
    return { name: u?.name ?? '', bio: u?.bio ?? '' };
  });

  readonly valores = {
    name: signal(this.salvo().name),
    bio: signal(this.salvo().bio),
  };
  salvando = signal(false);

  readonly campos = new Campos<Campo>(() => ({
    name: validarNome(this.valores.name()),
    bio: '',
  }));

  readonly mudancas = computed<AtualizacaoPerfil>(() => {
    const salvo = this.salvo();
    const atual: Record<Campo, string> = {
      name: this.valores.name().trim(),
      bio: this.valores.bio().trim(),
    };
    return Object.fromEntries(
      (Object.keys(atual) as Campo[]).filter((c) => atual[c] !== salvo[c]).map((c) => [c, atual[c]]),
    );
  });
  readonly mudou = computed(() => Object.keys(this.mudancas()).length > 0);

  private destroy$ = new Subject<void>();

  editar(campo: Campo, valor: string): void {
    this.valores[campo].set(valor);
    this.campos.editou(campo);
  }

  salvar(): void {
    if (this.salvando() || !this.mudou()) return;

    const invalido = this.campos.primeiroInvalido();
    if (invalido) {
      document.getElementById(`perfil-${invalido}`)?.focus();
      return;
    }

    this.salvando.set(true);
    this.auth
      .atualizarPerfil(this.mudancas())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuario) => {
          this.salvando.set(false);
          // o que a API guardou (bio aparada) volta para os campos
          this.valores.name.set(usuario.name);
          this.valores.bio.set(usuario.bio ?? '');
          this.toast.sucesso('Perfil atualizado', { chave: 'perfil' });
        },
        error: (falha) => {
          this.salvando.set(false);
          this.tratarFalha(falha);
        },
      });
  }

  private tratarFalha(falha: unknown): void {
    const status = falha instanceof HttpErrorResponse ? falha.status : -1;
    if (status === 400) {
      const recusados = camposRecusados(falha);
      const mensagens: Record<Campo, string> = {
        name: 'Use de 2 a 80 caracteres.',
        bio: 'Use até 300 caracteres.',
      };
      const campos = (Object.keys(mensagens) as Campo[]).filter((c) => recusados.has(c));
      campos.forEach((c) => this.campos.recusar(c, mensagens[c]));
      if (campos.length) return;
    }

    this.toast.erro('Não salvamos seu perfil', {
      detalhe: ehFalhaDeSistema(falha) ? mensagemDeErro(falha) : 'Revise os campos e tente de novo.',
      chave: 'perfil',
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
