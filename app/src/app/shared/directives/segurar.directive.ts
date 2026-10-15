import { Directive, ElementRef, EventEmitter, HostListener, OnDestroy, Output, inject } from '@angular/core';

const ESPERA = 450;
// dedo que andou mais que isso está rolando a fileira, não segurando
const FOLGA = 10;

// segurar o card no toque: abre as ações e engole o clique que viria ao soltar
@Directive({
  selector: '[appSegurar]',
  standalone: true,
})
export class SegurarDirective implements OnDestroy {
  @Output() appSegurar = new EventEmitter<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inicio = { x: 0, y: 0 };
  private segurou = false;
  private toque = false;

  // em captura: o routerLink do mesmo elemento não chega a navegar
  private readonly engolirClique = (e: MouseEvent) => {
    if (!this.segurou) return;
    this.segurou = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  constructor() {
    this.host.nativeElement.addEventListener('click', this.engolirClique, true);
  }

  @HostListener('pointerdown', ['$event'])
  aoApertar(e: PointerEvent): void {
    this.toque = e.pointerType !== 'mouse';
    this.segurou = false;
    if (!this.toque) return;

    this.inicio = { x: e.clientX, y: e.clientY };
    this.cancelar();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.segurou = true;
      this.appSegurar.emit();
    }, ESPERA);
  }

  @HostListener('pointermove', ['$event'])
  aoMover(e: PointerEvent): void {
    if (this.timer && Math.hypot(e.clientX - this.inicio.x, e.clientY - this.inicio.y) > FOLGA) {
      this.cancelar();
    }
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  @HostListener('pointerleave')
  cancelar(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // sem isso o Android abre o menu de link por cima da folha
  @HostListener('contextmenu', ['$event'])
  aoMenu(e: Event): void {
    if (this.toque) e.preventDefault();
  }

  ngOnDestroy(): void {
    this.cancelar();
    this.host.nativeElement.removeEventListener('click', this.engolirClique, true);
  }
}
