import { Component, Input, OnChanges, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideEllipsis, LucideStar } from '@lucide/angular';
import { TipoMidia } from '../../../core/models/catalogo.models';
import { FolhaAcoesService } from '../../../core/services/folha-acoes.service';
import { MarcasService } from '../../../core/services/marcas.service';
import { SegurarDirective } from '../../directives/segurar.directive';
import { AcoesCardComponent } from '../acoes-card/acoes-card.component';
import { MediaFallbackComponent } from '../media-fallback/media-fallback.component';
import { SeloMarcasComponent } from '../selo-marcas/selo-marcas.component';

// só o pôster e a nota; o hover (ou o ⋯ no toque) traz título e ações
@Component({
  selector: 'app-movie-card',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterModule,
    LucideEllipsis,
    LucideStar,
    AcoesCardComponent,
    MediaFallbackComponent,
    SeloMarcasComponent,
    SegurarDirective,
  ],
  templateUrl: './movie-card.component.html',
  styleUrls: ['./movie-card.component.css'],
  host: { class: 'block' },
})
export class MovieCardComponent implements OnChanges {
  @Input() id!: number;
  @Input() title!: string;
  @Input() posterPath: string | null = null;
  @Input() year: string = '';
  @Input() rating: number = 0;
  @Input() mediaType: 'movies' | 'series' = 'movies';

  private readonly marcas = inject(MarcasService);
  private readonly folha = inject(FolhaAcoesService);

  ngOnChanges(): void {
    if (this.id) this.marcas.pedir(this.id, this.tipo);
  }

  get tipo(): TipoMidia {
    return this.mediaType === 'movies' ? 'movie' : 'tv';
  }

  get posterUrl(): string {
    return this.posterPath ? `https://image.tmdb.org/t/p/w342${this.posterPath}` : '';
  }

  get detailsRoute(): string[] {
    return ['/search', this.mediaType, String(this.id)];
  }

  abrirFolha(): void {
    this.folha.abrir({
      tmdbId: this.id,
      tipo: this.tipo,
      titulo: this.title,
      ano: this.year,
      nota: this.rating,
      posterUrl: this.posterUrl,
    });
  }
}
