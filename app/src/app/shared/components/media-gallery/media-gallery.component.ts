import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideExternalLink,
  LucidePlay,
  LucideX,
} from '@lucide/angular';
import { ImageBackdrop, Video } from '../../../core/models/tmdb.models';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { environment } from '../../../../environments/environment';

type Aba = 'videos' | 'backdrops' | 'posters';

export interface MediaItem {
  kind: 'video' | 'image';
  id: string;
  title: string;
  subtitle: string;
  thumb: string;
  full: string;
  key: string;
}

const TIPOS_RELEVANTES = ['Trailer'];

const ROTULO_TIPO: Record<string, string> = {
  Trailer: 'Trailer',
  Teaser: 'Teaser',
};

const SWIPE_MINIMO = 60;

@Component({
  selector: 'app-media-gallery',
  standalone: true,
  imports: [
    CommonModule,
    LucidePlay,
    LucideX,
    LucideChevronLeft,
    LucideChevronRight,
    LucideExternalLink,
  ],
  templateUrl: './media-gallery.component.html',
  styleUrls: ['./media-gallery.component.css'],
})
export class MediaGalleryComponent implements OnDestroy {
  @Input() set videos(value: Video[]) {
    this.videosSignal.set(value ?? []);
  }
  @Input() set backdrops(value: ImageBackdrop[]) {
    this.backdropsSignal.set(value ?? []);
  }
  @Input() set posters(value: ImageBackdrop[]) {
    this.postersSignal.set(value ?? []);
  }

  private videosSignal = signal<Video[]>([]);
  private backdropsSignal = signal<ImageBackdrop[]>([]);
  private postersSignal = signal<ImageBackdrop[]>([]);

  private sanitizer = inject(DomSanitizer);
  private smoothScroll = inject(SmoothScrollService);

  activeTab = signal<Aba>('videos');

  // data-lenis-prevent só com o que rolar: sem barra, ele travava a página sob o mouse
  isScrollable = signal(false);

  private scrollEl?: HTMLElement;
  private resizeObserver?: ResizeObserver;

  @ViewChild('mediaScroll')
  set mediaScrollRef(el: ElementRef<HTMLElement> | undefined) {
    this.resizeObserver?.disconnect();
    this.scrollEl = el?.nativeElement;

    if (!this.scrollEl) {
      this.isScrollable.set(false);
      return;
    }

    this.measureScrollable();
    this.resizeObserver = new ResizeObserver(() => this.measureScrollable());
    this.resizeObserver.observe(this.scrollEl);
  }

  private measureScrollable(): void {
    const el = this.scrollEl;
    if (!el) return;
    this.isScrollable.set(el.scrollHeight - el.clientHeight > 1);
  }

  openIndex = signal<number | null>(null);

  private pesoVideo(video: Video): number {
    return TIPOS_RELEVANTES.indexOf(video.type) * 4
      + (video.iso_639_1 === 'pt' ? 0 : 2)
      + (video.official === false ? 1 : 0);
  }

  private playableVideos = computed<MediaItem[]>(() =>
    this.videosSignal()
      .filter((v) => v.site === 'YouTube' && TIPOS_RELEVANTES.includes(v.type))
      .sort((a, b) => this.pesoVideo(a) - this.pesoVideo(b))
      .map((v) => ({
        kind: 'video' as const,
        id: v.id,
        title: v.name,
        subtitle: ROTULO_TIPO[v.type] ?? v.type,
        thumb: `https://img.youtube.com/vi/${v.key}/hqdefault.jpg`,
        full: '',
        key: v.key,
      }))
  );

  private toImageItems(list: ImageBackdrop[], thumbSize: string): MediaItem[] {
    return list.map((image) => ({
      kind: 'image' as const,
      id: image.file_path,
      title: '',
      subtitle: `${image.width} × ${image.height}`,
      thumb: this.imageUrl(image, thumbSize),
      full: this.imageUrl(image, 'original'),
      key: '',
    }));
  }

  private backdropItems = computed(() => this.toImageItems(this.backdropsSignal(), 'w780'));
  private posterItems = computed(() => this.toImageItems(this.postersSignal(), 'w342'));

  tabs = computed(() => {
    const list: { id: Aba; label: string; count: number }[] = [
      { id: 'videos', label: 'Vídeos', count: this.playableVideos().length },
      { id: 'backdrops', label: 'Imagens', count: this.backdropItems().length },
      { id: 'posters', label: 'Pôsteres', count: this.posterItems().length },
    ];
    return list.filter((t) => t.count > 0);
  });

  hasMedia = computed(() => this.tabs().length > 0);

  resolvedTab = computed<Aba | null>(() => {
    const disponiveis = this.tabs().map((t) => t.id);
    if (!disponiveis.length) return null;
    return disponiveis.includes(this.activeTab()) ? this.activeTab() : disponiveis[0];
  });

  items = computed<MediaItem[]>(() => {
    switch (this.resolvedTab()) {
      case 'videos':
        return this.playableVideos();
      case 'backdrops':
        return this.backdropItems();
      case 'posters':
        return this.posterItems();
      default:
        return [];
    }
  });

  currentItem = computed<MediaItem | null>(() => {
    const index = this.openIndex();
    return index === null ? null : this.items()[index] ?? null;
  });

  safeEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const item = this.currentItem();
    if (!item || item.kind !== 'video') return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${item.key}?autoplay=1&rel=0&modestbranding=1`
    );
  });

  youtubeUrl = computed(() => {
    const item = this.currentItem();
    return item?.kind === 'video' ? `https://www.youtube.com/watch?v=${item.key}` : '';
  });

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.openIndex() !== null) this.smoothScroll.start();
  }

  selectTab(tab: Aba): void {
    this.activeTab.set(tab);
    // cada aba tem uma quantidade diferente de itens; remede depois de renderizar
    setTimeout(() => this.measureScrollable());
  }

  imageUrl(image: ImageBackdrop, size: string): string {
    return `${environment.tmdbImageUrl}/${size}${image.file_path}`;
  }

  open(index: number): void {
    if (this.openIndex() === null) this.smoothScroll.stop();
    this.openIndex.set(index);
    this.preloadVizinhos(index);
  }

  close(): void {
    if (this.openIndex() === null) return;
    this.openIndex.set(null);
    this.smoothScroll.start();
  }

  step(delta: number): void {
    const total = this.items().length;
    const atual = this.openIndex();
    if (atual === null || total === 0) return;
    const proximo = (atual + delta + total) % total;
    this.openIndex.set(proximo);
    this.preloadVizinhos(proximo);
  }

  private preloadVizinhos(index: number): void {
    const total = this.items().length;
    if (total < 2) return;
    for (const delta of [1, -1]) {
      const vizinho = this.items()[(index + delta + total) % total];
      if (vizinho?.kind === 'image') new Image().src = vizinho.full;
    }
  }

  private touchStartX: number | null = null;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? null;
  }

  onTouchEnd(event: TouchEvent): void {
    const inicio = this.touchStartX;
    this.touchStartX = null;
    if (inicio === null) return;
    const distancia = (event.changedTouches[0]?.clientX ?? inicio) - inicio;
    if (Math.abs(distancia) < SWIPE_MINIMO) return;
    this.step(distancia < 0 ? 1 : -1);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  @HostListener('document:keydown.arrowright')
  onArrowRight(): void {
    if (this.openIndex() !== null) this.step(1);
  }

  @HostListener('document:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.openIndex() !== null) this.step(-1);
  }
}
