import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { mensagemDeErro } from '../errors/mensagens';
import { NovosSeguidores, UsuarioResumo } from '../models/auth.models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { UsuarioService } from './usuario.service';

const CHAVE = 'seguidores-novos';

// avisa uma vez, quando a sessão começa: o toast some e não volta na próxima visita
@Injectable({ providedIn: 'root' })
export class SeguidoresNovosService {
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private verificadoPara: string | null = null;

  constructor() {
    effect(() => {
      const usuario = this.auth.usuario();
      if (!usuario) {
        this.verificadoPara = null;
        return;
      }
      if (this.verificadoPara === usuario.id) return;

      this.verificadoPara = usuario.id;
      untracked(() => this.verificar(usuario.username));
    });
  }

  private verificar(meuUsername: string): void {
    this.usuarioService.novosSeguidores().subscribe({
      next: (novos) => {
        if (novos.total === 0 || !novos.ate || novos.recentes.length === 0) return;

        this.avisar(novos, meuUsername);
        // marca até o follow mostrado: quem chegar depois continua novo
        this.usuarioService.marcarSeguidoresVistos(novos.ate).subscribe({ error: () => {} });
      },
      // é um enfeite da chegada: se falhar, só não avisa
      error: () => {},
    });
  }

  private avisar(novos: NovosSeguidores, meuUsername: string): void {
    const [primeiro, ...outros] = novos.recentes;

    if (novos.total === 1) {
      const verPerfil = { rotulo: 'Ver perfil', executar: () => this.router.navigate(['/username', primeiro.username]) };
      this.toast.info(`${primeiro.username} começou a seguir você`, {
        detalhe: this.resumo(primeiro),
        chave: CHAVE,
        ...(primeiro.seguindo
          ? { acao: verPerfil }
          : {
              acao: { rotulo: 'Seguir de volta', executar: () => this.seguirDeVolta(primeiro) },
              acaoSecundaria: verPerfil,
            }),
      });
      return;
    }

    const titulo =
      novos.total === 2
        ? `${primeiro.username} e ${outros[0].username} começaram a seguir você`
        : `${primeiro.username} e mais ${novos.total - 1} começaram a seguir você`;
    const detalhe =
      novos.total === 2
        ? undefined
        : `${outros.map((u) => u.username).join(' e ')}${novos.total > 3 ? ', entre outros' : ''} também.`;

    this.toast.info(titulo, {
      detalhe,
      chave: CHAVE,
      acao: {
        rotulo: 'Ver seguidores',
        executar: () => this.router.navigate(['/username', meuUsername], { queryParams: { lista: 'seguidores' } }),
      },
    });
  }

  // sem takeUntil: a ação do toast sobrevive à troca de rota
  private seguirDeVolta(usuario: UsuarioResumo): void {
    this.usuarioService.seguir(usuario.id).subscribe({
      // o toast some: sem este aviso, não haveria como saber que deu certo
      next: () => this.toast.sucesso(`Você segue ${usuario.username}`, { chave: CHAVE }),
      error: (falha) =>
        this.toast.erro('Não seguimos este perfil', { detalhe: mensagemDeErro(falha), chave: CHAVE }),
    });
  }

  private resumo(usuario: UsuarioResumo): string {
    const { avaliacoes, seguidores } = usuario.contagem;
    return `${avaliacoes} ${avaliacoes === 1 ? 'avaliação' : 'avaliações'} · ${seguidores} ${seguidores === 1 ? 'seguidor' : 'seguidores'}`;
  }
}
