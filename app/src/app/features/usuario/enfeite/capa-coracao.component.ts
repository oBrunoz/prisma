import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ESPECTRO } from '../../../core/models/espectro';

// mesma faixa colada em todos os anéis: cada um é escalado, então o traço compensa a escala
const ESCALAS = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52];
const TRACO = 3.86;

@Component({
  selector: 'app-capa-coracao',
  standalone: true,
  templateUrl: './capa-coracao.component.html',
  styleUrls: ['./capa-coracao.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapaCoracaoComponent {
  readonly src = input.required<string>();

  readonly aneis = ESPECTRO.map((cor, i) => ({
    cor,
    transform: `translate(50 46) scale(${ESCALAS[i]}) translate(-50 -46)`,
    largura: TRACO / ESCALAS[i],
  }));
}
