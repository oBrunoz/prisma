import { Component, Input } from '@angular/core';
import { LucideTicket } from '@lucide/angular';
import { OndeAssistir } from '../../../core/models/onde-assistir';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-plataformas',
  standalone: true,
  imports: [LucideTicket],
  templateUrl: './plataformas.component.html',
  host: { class: 'inline-flex items-center min-w-0' },
})
export class PlataformasComponent {
  @Input({ required: true }) onde!: OndeAssistir;
  // lado do logo em px
  @Input() tamanho = 20;

  get todas(): string {
    return this.onde.plataformas.map((p) => p.nome).join(', ');
  }

  logoUrl(caminho: string | null): string {
    return caminho ? `${environment.tmdbImageUrl}/w92${caminho}` : '';
  }
}
