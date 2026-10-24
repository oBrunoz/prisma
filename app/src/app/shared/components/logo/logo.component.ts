import { Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export type LogoVariant = 'mark' | 'horizontal' | 'spectral' | 'lettering';

// ids de filtro/máscara precisam ser únicos se houver mais de um logo espectral na página
let seq = 0;

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.css'],
  host: { '[class.intro]': 'intro' },
})
export class LogoComponent {
  @Input() variant: LogoVariant = 'horizontal';

  @Input() label = 'Prisma';

  @Input() intro = false;

  protected readonly uid = `prisma-${++seq}`;
}
