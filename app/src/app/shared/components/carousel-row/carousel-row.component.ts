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

  pageCount = signal(1);
  currentPage = signal(0);

  pages = computed(() => Array(this.pageCount()).fill(0));

  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.updateEdges();

    this.resizeObserver = new ResizeObserver(() => this.updateEdges());
    this.resizeObserver.observe(this.trackRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  updateEdges(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

    this.canScrollLeft.set(!atStart);
    this.canScrollRight.set(!atEnd);

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
