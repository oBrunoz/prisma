import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { InfoJogo } from '../../../../core/models/jogos.models';
import { ESPECTRO } from '../../../../core/models/espectro';

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
  readonly exemplo = [...'CINEMAS'].map((l, i) => ({ l, cor: 'aaalaac'[i] }));

  ngAfterViewInit(): void {
    this.entendi?.nativeElement.focus({ preventScroll: true });
  }
}
