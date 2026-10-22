import { AfterViewInit, ChangeDetectionStrategy, Component, ViewChild, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { TravessiaComponent } from '../../shared/components/travessia/travessia.component';
import { JogosEstado } from './jogos.estado';

// a aba: a janela abre, as listras viram o fundo e a escolha ou a partida entram por cima
@Component({
  selector: 'app-jogos',
  standalone: true,
  imports: [RouterOutlet, TravessiaComponent],
  templateUrl: './jogos.component.html',
  styleUrls: ['./jogos.component.css'],
  providers: [JogosEstado],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JogosComponent implements AfterViewInit {
  readonly estado = inject(JogosEstado);
  private readonly router = inject(Router);

  @ViewChild(TravessiaComponent) private travessia!: TravessiaComponent;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly emPartida = computed(() => /^\/jogos\/[^/?#]+/.test(this.url()));

  constructor() {
    this.estado.carregar();
  }

  // quem chega direto numa partida não espera a abertura
  ngAfterViewInit(): void {
    if (this.emPartida()) this.travessia?.pular();
  }
}
