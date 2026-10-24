import { Component, DestroyRef, NgZone, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideChevronDown } from '@lucide/angular';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { OutraPagina, SecaoLegal } from '../legal.config';

@Component({
  selector: 'app-pagina-legal',
  standalone: true,
  imports: [RouterModule, LucideChevronDown],
  templateUrl: './pagina-legal.component.html',
})
export class PaginaLegalComponent {
  private readonly scroll = inject(SmoothScrollService);

  readonly titulo = input.required<string>();
  readonly rota = input.required<string>();
  readonly secoes = input.required<SecaoLegal[]>();
  readonly outras = input.required<OutraPagina[]>();
  readonly apoio = input('');

  readonly indiceAberto = signal(false);
  readonly atual = signal('');
  readonly tituloAtual = computed(() => this.secoes().find((s) => s.id === this.atual())?.titulo ?? '');

  // seção curta no fim da página nunca chega à linha: a clicada no índice fica marcada até a pessoa rolar
  private escolhida = '';

  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);

    // link com #secao: salto nativo, porque o Lenis ainda não mediu a página nova
    afterNextRender(() => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());

      let quadro = 0;
      const medir = () => {
        quadro = 0;
        this.atual.set(this.escolhida || this.secaoNaTela());
      };
      const aoRolar = () => (quadro ||= requestAnimationFrame(medir));
      const soltar = () => (this.escolhida = '');

      zone.runOutsideAngular(() => {
        window.addEventListener('scroll', aoRolar, { passive: true });
        window.addEventListener('resize', aoRolar, { passive: true });
        for (const gesto of ['wheel', 'touchmove', 'keydown'] as const) {
          window.addEventListener(gesto, soltar, { passive: true });
        }
      });
      medir();

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(quadro);
        window.removeEventListener('scroll', aoRolar);
        window.removeEventListener('resize', aoRolar);
        for (const gesto of ['wheel', 'touchmove', 'keydown'] as const) {
          window.removeEventListener(gesto, soltar);
        }
      });
    });
  }

  // o router trataria o # como navegação e voltaria ao topo; o Lenis faz a descida
  irPara(id: string, evento: Event): void {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    evento.preventDefault();
    this.escolhida = id;
    this.atual.set(id);
    this.indiceAberto.set(false);
    // espera o índice recolher no celular, senão o alvo sobe depois de medido
    requestAnimationFrame(() => this.scroll.scrollTo(alvo, -16));
  }

  private secaoNaTela(): string {
    const secoes = this.secoes();
    const fim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (fim) return secoes.at(-1)?.id ?? '';

    const linha = Math.max(160, window.innerHeight / 3);
    let atual = '';
    for (const { id } of secoes) {
      const topo = document.getElementById(id)?.getBoundingClientRect().top;
      if (topo === undefined || topo > linha) break;
      atual = id;
    }
    return atual;
  }
}
