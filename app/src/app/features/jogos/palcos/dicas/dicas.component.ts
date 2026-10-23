import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { LucideLightbulb } from '@lucide/angular';
import { ConteudoComDicas, MAX_DICAS } from '../../../../core/models/jogos.models';

export type TipoDeDica = 'letra' | 'pista';

// as dicas do letreiro e da legenda: as já usadas em cima, e o botão que abre as duas opções
@Component({
  selector: 'app-dicas',
  standalone: true,
  imports: [LucideLightbulb],
  templateUrl: './dicas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DicasComponent {
  @Input({ required: true }) conteudo!: ConteudoComDicas;
  @Input() ocupado = false;
  // o que a dica de letra faz em cada jogo
  @Input() rotuloLetra = 'Acender uma letra';

  @Output() pedir = new EventEmitter<TipoDeDica>();

  readonly aberta = signal(false);
  readonly maximo = MAX_DICAS;

  get restam(): number {
    return this.maximo - this.conteudo.dicas.length;
  }

  escolher(tipo: TipoDeDica): void {
    this.aberta.set(false);
    this.pedir.emit(tipo);
  }
}
