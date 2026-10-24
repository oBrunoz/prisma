import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Genre, WatchProviderCountry } from '../../../core/models/tmdb.models';
import { OndeAssistir, ondeAssistir } from '../../../core/models/onde-assistir';
import { TipoMidia } from '../../../core/models/catalogo.models';
import { PlataformasComponent } from '../plataformas/plataformas.component';
import { QuickActionsComponent } from '../quick-actions/quick-actions.component';
import {
  LucideTriangleAlert,
  LucideRotateCcw,
  LucideStar,
  LucidePlay,
  LucidePause,
  LucideInfo,
} from '@lucide/angular';
import { noTamanho, srcsetDeFundo } from '../../../core/services/movie.service';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterModule, PlataformasComponent, QuickActionsComponent, LucideTriangleAlert, LucideRotateCcw, LucideStar, LucidePlay, LucidePause, LucideInfo],
  templateUrl: './hero-section.component.html',
  styleUrl: './hero-section.component.css'
})
export class HeroSectionComponent implements OnChanges {
  readonly srcsetDeFundo = srcsetDeFundo;
  readonly noTamanho = noTamanho;

  @Input() label = '';
  @Input() title = '';
  @Input() logoUrl = '';
  @Input() backgroundUrl = '';
  // os tamanhos que a tela pode pedir, com a original na largura real; sem ele, supõe 1920
  @Input() backgroundSrcset = '';
  @Input() logoSrcset = '';
  @Input() isLoading = false;
  @Input() hasError = false;
  @Input() rating?: number;
  @Input() releaseYear = '';
  @Input() runtime = '';
  @Input() tagline = '';
  @Input() genres: Genre[] = [];
  @Input() overview = '';
  @Input() trailerUrl = '#';
  @Input() provedores: WatchProviderCountry | null = null;
  @Input() estreia: string | null = null;

  onde: OndeAssistir | null = null;
  
  @Input() detailsRoute: unknown[] | null = null;

  @Input() tmdbId: number | null = null;
  @Input() mediaType: TipoMidia | null = null;

  @Output() avaliarClicked = new EventEmitter<void>();
  @Output() conviteVisivel = new EventEmitter<boolean>();

  @Output() retryClicked = new EventEmitter<void>();

  @Output() trailerOpened = new EventEmitter<void>();
  @Output() trailerClosed = new EventEmitter<void>();

  @ViewChild('trailerPlayer') trailerPlayer?: ElementRef<HTMLIFrameElement>;

  isTrailerVisible = signal(false);
  isBgLoaded = signal(false);

  isCloseHintVisible = signal(false);
  private closeHintTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(mudancas: SimpleChanges): void {
    if (mudancas['backgroundUrl']) this.isBgLoaded.set(false);
    if (mudancas['provedores'] || mudancas['estreia']) {
      const onde = ondeAssistir(this.provedores, this.estreia);
      this.onde = onde.plataformas.length || onde.nosCinemas ? onde : null;
    }
  }

  onBackgroundLoad(): void {
    this.isBgLoaded.set(true);
  }

  openTrailer(): void {
    if (!this.trailerUrl || this.trailerUrl === '#') return;
    this.isTrailerVisible.set(true);
    this.trailerOpened.emit();
    if (this.trailerPlayer) {
      this.trailerPlayer.nativeElement.src = `${this.trailerUrl}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1`;
    }

    this.isCloseHintVisible.set(true);
    clearTimeout(this.closeHintTimer);
    this.closeHintTimer = setTimeout(() => this.isCloseHintVisible.set(false), 3000);
  }

  closeTrailer(): void {
    this.trailerClosed.emit();
    this.isTrailerVisible.set(false);
    this.isCloseHintVisible.set(false);
    clearTimeout(this.closeHintTimer);
    if (this.trailerPlayer) {
      this.trailerPlayer.nativeElement.src = '';
    }
  }
}
