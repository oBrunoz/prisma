import {
  Component,
  ElementRef,
  Input,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

@Component({
  selector: 'app-carousel-row',
  standalone: true,
  imports: [CommonModule, LucideChevronLeft, LucideChevronRight],
  templateUrl: './carousel-row.component.html',
  styleUrls: ['./carousel-row.component.css'],
})
export class CarouselRowComponent implements AfterViewInit, OnDestroy {
  @Input() step = 0.8;
  @Input() loop = true;
  // false dentro de caixas (modal, card): sem gutter da página para sangrar
  @Input() sangria = true;

  @ViewChild('track') trackRef!: ElementRef<HTMLElement>;

  canScrollLeft = signal(false);
  canScrollRight = signal(false);
  // sem conteúdo além da largura não há o que passar: setas somem mesmo com loop
  transborda = signal(false);

  pageCount = signal(1);
  currentPage = signal(0);

  pages = computed(() => Array(this.pageCount()).fill(0));

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  ngAfterViewInit(): void {
    this.updateEdges();

    this.resizeObserver = new ResizeObserver(() => this.updateEdges());
    this.resizeObserver.observe(this.trackRef.nativeElement);

    // itens que chegam ou saem sem mudar a altura da fileira não disparam o ResizeObserver
    this.mutationObserver = new MutationObserver(() => this.updateEdges());
    this.mutationObserver.observe(this.trackRef.nativeElement, { childList: true });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  updateEdges(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

    this.canScrollLeft.set(!atStart);
    this.canScrollRight.set(!atEnd);
    this.transborda.set(el.scrollWidth > el.clientWidth + 1);

    const total = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
    this.pageCount.set(total);

    this.currentPage.set(
      atEnd ? total - 1 : Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth))
    );
  }

  scrollBy(direction: -1 | 1): void {
    const el = this.trackRef.nativeElement;
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

    if (this.loop && direction === 1 && atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    if (this.loop && direction === -1 && atStart) {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      return;
    }

    el.scrollBy({ left: direction * el.clientWidth * this.step, behavior: 'smooth' });
  }

  goToPage(index: number): void {
    const el = this.trackRef.nativeElement;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }
}
