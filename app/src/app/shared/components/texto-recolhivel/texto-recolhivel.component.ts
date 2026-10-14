import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

// mesmos cortes do line-clamp-6: passou de um deles, o texto ganha "Ler mais"
const LIMITE_CARACTERES = 420;
const LIMITE_LINHAS = 6;

@Component({
  selector: 'app-texto-recolhivel',
  standalone: true,
  templateUrl: './texto-recolhivel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextoRecolhivelComponent {
  @Input({ required: true }) texto = '';

  aberto = signal(false);

  get longo(): boolean {
    return this.texto.length > LIMITE_CARACTERES || this.texto.split('\n').length > LIMITE_LINHAS;
  }
}
