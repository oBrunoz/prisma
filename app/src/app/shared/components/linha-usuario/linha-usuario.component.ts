import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideUserCheck, LucideUserPlus } from '@lucide/angular';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { UsuarioResumo } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

@Component({
  selector: 'app-linha-usuario',
  standalone: true,
  imports: [RouterModule, UserAvatarComponent, LucideUserPlus, LucideUserCheck],
  templateUrl: './linha-usuario.component.html',
})
export class LinhaUsuarioComponent {
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly toast = inject(ToastService);

  readonly usuario = input.required<UsuarioResumo>();
  // quem abre a linha (ex.: a janela de seguidores) fecha ao navegar
  readonly abriu = output<void>();
  readonly mudouSeguindo = output<boolean>();

  readonly seguindo = linkedSignal(() => this.usuario().seguindo ?? false);
  readonly alternando = signal(false);
  readonly souEu = computed(() => this.usuario().id === this.auth.usuario()?.id);

  plural(quantidade: number, um: string, varios: string): string {
    return `${quantidade} ${quantidade === 1 ? um : varios}`;
  }

  // sem takeUntil: seguir precisa gravar mesmo se a janela fechar no meio
  alternarFollow(): void {
    const usuario = this.usuario();
    if (this.alternando()) return;

    if (!this.auth.autenticado()) {
      this.auth.pedirLogin(`Entre para seguir ${usuario.username}`);
      return;
    }

    const seguir = !this.seguindo();
    this.alternando.set(true);

    this.usuarioService.definirSeguindo(usuario.id, seguir).subscribe({
      next: () => {
        this.seguindo.set(seguir);
        this.alternando.set(false);
        this.mudouSeguindo.emit(seguir);
      },
      error: (falha) => {
        this.alternando.set(false);
        this.toast.erro(seguir ? 'Não seguimos este perfil' : 'Não deixamos de seguir este perfil', {
          detalhe: mensagemDeErro(falha),
          chave: `seguir-${usuario.id}`,
        });
      },
    });
  }
}
