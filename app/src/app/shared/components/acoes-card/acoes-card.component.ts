import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { LucideBookmark, LucideCheck, LucideEye, LucideHeart } from '@lucide/angular';
import { TipoMidia } from '../../../core/models/catalogo.models';
import { ACOES_RAPIDAS, MarcasService } from '../../../core/services/marcas.service';

// assistido, curtir e watchlist sobre a imagem do card; só com mouse (no toque é a folha)
@Component({
  selector: 'app-acoes-card',
  standalone: true,
  imports: [LucideBookmark, LucideCheck, LucideEye, LucideHeart],
  templateUrl: './acoes-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcoesCardComponent {
  @Input({ required: true }) tmdbId!: number;
  @Input({ required: true }) tipo!: TipoMidia;
  @Input() titulo = '';

  readonly marcas = inject(MarcasService);
  readonly acoes = ACOES_RAPIDAS;
}
