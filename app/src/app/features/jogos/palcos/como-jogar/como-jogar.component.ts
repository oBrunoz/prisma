import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { InfoJogo } from '../../../../core/models/jogos.models';
import { ESPECTRO } from '../../../../core/models/espectro';

// o como jogar de cada jogo: folha que sobe no celular, centralizada a partir do sm
@Component({
  selector: 'app-como-jogar',
  standalone: true,
  imports: [LucideX],
  templateUrl: './como-jogar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComoJogarComponent implements AfterViewInit {
  @Input({ required: true }) info!: InfoJogo;
  @Output() fechar = new EventEmitter<void>();

  @ViewChild('entendi') private entendi?: ElementRef<HTMLButtonElement>;

  readonly espectro = ESPECTRO;
  // o exemplo da legenda: CINEMAS contra uma palavra que termina em S e tem E em outro lugar
  readonly exemplo = [...'CINEMAS'].map((l, i) => ({ l, cor: 'aaalaac'[i] }));

  ngAfterViewInit(): void {
    this.entendi?.nativeElement.focus({ preventScroll: true });
  }
}
