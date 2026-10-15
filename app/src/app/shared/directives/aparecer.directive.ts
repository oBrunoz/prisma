import { AfterViewInit, Directive, ElementRef, EventEmitter, NgZone, OnDestroy, Output, inject } from '@angular/core';

// avisa uma vez quando o elemento chega perto da tela: a seção só carrega quando vai ser vista
@Directive({
  selector: '[appAparecer]',
  standalone: true,
})
export class AparecerDirective implements AfterViewInit, OnDestroy {
  @Output() appAparecer = new EventEmitter<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zona = inject(NgZone);
  private observador?: IntersectionObserver;

  ngAfterViewInit(): void {
    this.zona.runOutsideAngular(() => {
      this.observador = new IntersectionObserver(
        (entradas) => {
          if (!entradas[0]?.isIntersecting) return;
          this.observador?.disconnect();
          this.zona.run(() => this.appAparecer.emit());
        },
        // com folga: o dado chega antes da seção entrar na tela e nada muda de altura à vista
        { rootMargin: '800px 0px' },
      );
      this.observador.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }
}
