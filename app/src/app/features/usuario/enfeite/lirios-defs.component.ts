import { ChangeDetectionStrategy, Component } from '@angular/core';

// montado uma vez no perfil; os enfeites usam os desenhos por <use href>
@Component({
  selector: 'app-lirios-defs',
  standalone: true,
  templateUrl: './lirios-defs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiriosDefsComponent {
  readonly sepalas = [0, 120, 240];
  readonly petalas = [60, 180, 300];
  readonly seis = [0, 60, 120, 180, 240, 300];
  readonly estames = [20, 80, 140, 200, 260, 320];
  readonly estamesV = [15, 75, 135, 195, 255, 315];
  readonly gerberaFora = Array.from({ length: 16 }, (_, i) => i * 22.5);
  readonly gerberaDentro = Array.from({ length: 16 }, (_, i) => 11.25 + i * 22.5);
}
