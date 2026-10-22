import { Component, afterNextRender, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideChevronDown } from '@lucide/angular';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { ATUALIZADO_EM, SecaoLegal } from '../legal.config';

// a moldura de leitura das páginas legais: título, data, índice e o texto projetado
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
  readonly outra = input.required<{ rota: string; rotulo: string }>();

  readonly atualizadoEm = ATUALIZADO_EM;
  readonly indiceAberto = signal(false);

  constructor() {
    // link com #secao: salto nativo, porque o Lenis ainda não mediu a página nova
    afterNextRender(() => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    });
  }

  // o router trataria o # como navegação e voltaria ao topo; o Lenis faz a descida
  irPara(id: string, evento: Event): void {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    evento.preventDefault();
    this.indiceAberto.set(false);
    // espera o índice recolher no celular, senão o alvo sobe depois de medido
    requestAnimationFrame(() => this.scroll.scrollTo(alvo, -16));
  }
}
