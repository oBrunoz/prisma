import { Component, ElementRef, computed, input, model, viewChild } from '@angular/core';
import { FocoCapa, ZOOM_MAXIMO_CAPA, estiloDaCapa } from '../../../../core/models/auth.models';
import { environment } from '../../../../../environments/environment';

const limitar = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));
const arredondar = (valor: number) => Math.round(valor * 10) / 10;

@Component({
  selector: 'app-enquadrar-capa',
  standalone: true,
  templateUrl: './enquadrar-capa.component.html',
})
export class EnquadrarCapaComponent {
  readonly imagem = input.required<string>();
  readonly username = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly foco = model.required<FocoCapa>();

  readonly zoomMaximo = ZOOM_MAXIMO_CAPA;
  readonly estilo = computed(() => estiloDaCapa(this.foco()));

  // como no app-user-avatar: a foto enviada vem relativa à API
  readonly avatar = computed(() => {
    const url = this.avatarUrl();
    if (!url) return null;
    return url.startsWith('/') ? `${environment.apiUrl}${url}` : url;
  });
  readonly inicial = computed(() => (this.username().trim() || '?').charAt(0).toUpperCase());

  private readonly origem = viewChild.required<ElementRef<HTMLElement>>('origem');
  private arrastando = false;

  aoTocar(evento: PointerEvent): void {
    this.arrastando = true;
    this.origem().nativeElement.setPointerCapture(evento.pointerId);
    this.marcar(evento);
  }

  aoMover(evento: PointerEvent): void {
    if (this.arrastando) this.marcar(evento);
  }

  soltar(): void {
    this.arrastando = false;
  }

  aoTeclar(evento: KeyboardEvent): void {
    const setas: Record<string, [number, number]> = {
      ArrowLeft: [-2, 0],
      ArrowRight: [2, 0],
      ArrowUp: [0, -2],
      ArrowDown: [0, 2],
    };
    const passo = setas[evento.key];
    if (!passo) return;
    evento.preventDefault();
    this.foco.update((f) => ({
      ...f,
      x: limitar(f.x + passo[0], 0, 100),
      y: limitar(f.y + passo[1], 0, 100),
    }));
  }

  aproximar(zoom: number): void {
    this.foco.update((f) => ({ ...f, zoom: Math.round(limitar(zoom, 1, ZOOM_MAXIMO_CAPA) * 100) / 100 }));
  }

  private marcar(evento: PointerEvent): void {
    const caixa = this.origem().nativeElement.getBoundingClientRect();
    this.foco.update((f) => ({
      ...f,
      x: arredondar(limitar(((evento.clientX - caixa.left) / caixa.width) * 100, 0, 100)),
      y: arredondar(limitar(((evento.clientY - caixa.top) / caixa.height) * 100, 0, 100)),
    }));
  }
}
