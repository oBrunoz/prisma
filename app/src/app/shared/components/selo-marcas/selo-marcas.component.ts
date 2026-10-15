import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { LucideBookmark, LucideEye, LucideHeart } from '@lucide/angular';
import { TipoMidia } from '../../../core/models/catalogo.models';
import { MarcasService } from '../../../core/services/marcas.service';

// o que o usuário já marcou, visível sem hover: olho, coração, marcador
@Component({
  selector: 'app-selo-marcas',
  standalone: true,
  imports: [LucideBookmark, LucideEye, LucideHeart],
  templateUrl: './selo-marcas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeloMarcasComponent {
  @Input({ required: true }) tmdbId!: number;
  @Input({ required: true }) tipo!: TipoMidia;

  readonly marcas = inject(MarcasService);
}
