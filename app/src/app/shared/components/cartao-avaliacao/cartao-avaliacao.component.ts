import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideHeart, LucideTrash2 } from '@lucide/angular';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { AvaliacaoUsuario, Midia } from '../../../core/models/catalogo.models';
import { AvaliacaoService } from '../../../core/services/avaliacao.service';
import { MovieService } from '../../../core/services/movie.service';
import { ToastService } from '../../../core/services/toast.service';
import { EstrelasComponent } from '../../../shared/components/estrelas/estrelas.component';
import { MediaFallbackComponent } from '../../../shared/components/media-fallback/media-fallback.component';
import { TextoRecolhivelComponent } from '../../../shared/components/texto-recolhivel/texto-recolhivel.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';

@Component({
  selector: 'app-cartao-avaliacao',
  standalone: true,
  imports: [
    DatePipe,
    RouterModule,
    EstrelasComponent,
    MediaFallbackComponent,
    TextoRecolhivelComponent,
    UserAvatarComponent,
    LucideHeart,
    LucideTrash2,
  ],
  templateUrl: './cartao-avaliacao.component.html',
})
export class CartaoAvaliacaoComponent {
  private readonly avaliacaoService = inject(AvaliacaoService);
  private readonly movieService = inject(MovieService);
  private readonly toast = inject(ToastService);

  readonly avaliacao = input.required<AvaliacaoUsuario>();
  // resumido: texto cortado em três linhas, como na visão geral
  readonly resumido = input(false);
  readonly podeExcluir = input(false);
  // fora do perfil (na home), o cartão diz quem escreveu
  readonly mostrarAutor = input(false);
  readonly excluida = output<void>();

  readonly confirmando = signal(false);
  readonly excluindo = signal(false);

  excluir(): void {
    if (this.excluindo()) return;
    if (!this.confirmando()) {
      this.confirmando.set(true);
      return;
    }

    const avaliacao = this.avaliacao();
    this.confirmando.set(false);
    this.excluindo.set(true);

    this.avaliacaoService.remover(avaliacao.id).subscribe({
      next: () => {
        this.excluindo.set(false);
        this.excluida.emit();
        // o cartão some da tela: o resultado só aparece aqui
        this.toast.sucesso('Avaliação excluída', {
          detalhe: avaliacao.media?.title,
          chave: `avaliacao-${avaliacao.id}`,
        });
      },
      error: (falha) => {
        this.excluindo.set(false);
        this.toast.erro('Não excluímos sua avaliação', {
          detalhe: mensagemDeErro(falha),
          chave: `avaliacao-${avaliacao.id}`,
        });
      },
    });
  }

  posterUrl(midia: Midia): string {
    return this.movieService.getImageUrl(midia.posterPath, 'w154');
  }

  tipoDeCard(midia: Midia): 'movies' | 'series' {
    return midia.type === 'MOVIE' ? 'movies' : 'series';
  }

  ano(midia: Midia): string {
    return midia.releaseDate ? midia.releaseDate.slice(0, 4) : '';
  }
}
