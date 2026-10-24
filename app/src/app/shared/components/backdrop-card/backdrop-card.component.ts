import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideEllipsis, LucideStar } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { TipoMidia } from '../../../core/models/catalogo.models';
import { FolhaAcoesService } from '../../../core/services/folha-acoes.service';
import { MarcasService } from '../../../core/services/marcas.service';
import { MovieService } from '../../../core/services/movie.service';
import { SegurarDirective } from '../../directives/segurar.directive';
import { AcoesCardComponent } from '../acoes-card/acoes-card.component';
import { MediaFallbackComponent } from '../media-fallback/media-fallback.component';
import { SeloMarcasComponent } from '../selo-marcas/selo-marcas.component';

@Component({
  selector: 'app-backdrop-card',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterModule,
    LucideEllipsis,
    LucideStar,
    AcoesCardComponent,
    MediaFallbackComponent,
    SeloMarcasComponent,
    SegurarDirective,
  ],
  templateUrl: './backdrop-card.component.html',
  styleUrls: ['./backdrop-card.component.css'],
  host: { class: 'block' },
})
export class BackdropCardComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() id!: number;
  @Input() title!: string;
  @Input() backdropPath: string | null = null;
  @Input() posterPath: string | null = null;
  @Input() year: string = '';
  @Input() rating: number = 0;
  @Input() mediaType: 'movies' | 'series' = 'movies';

  // '' é "não tem logo": aí entra o título em texto. null é "ainda não sei"
  logoUrl = signal<string | null>(null);

  private readonly marcas = inject(MarcasService);
  private readonly folha = inject(FolhaAcoesService);
  private readonly movies = inject(MovieService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private observer?: IntersectionObserver;
  private visto = false;
  private readonly trocou$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  ngOnChanges(): void {
    if (!this.id) return;
    this.marcas.pedir(this.id, this.tipo);
    this.trocou$.next();
    this.logoUrl.set(null);
    if (this.visto) this.buscarLogo();
  }

  // a logo é uma chamada por título: só quando o card chega perto da tela
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entradas) => {
          if (!entradas[0]?.isIntersecting) return;
          this.observer?.disconnect();
          this.zone.run(() => {
            this.visto = true;
            this.buscarLogo();
          });
        },
        { rootMargin: '200px' },
      );
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.trocou$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get tipo(): TipoMidia {
    return this.mediaType === 'movies' ? 'movie' : 'tv';
  }

  get backdropUrl(): string {
    return this.backdropPath ? `https://image.tmdb.org/t/p/w780${this.backdropPath}` : '';
  }

  get detailsRoute(): string[] {
    return ['/search', this.mediaType, String(this.id)];
  }

  abrirFolha(): void {
    this.folha.abrir({
      tmdbId: this.id,
      tipo: this.tipo,
      titulo: this.title,
      ano: this.year,
      nota: this.rating,
      posterUrl: this.posterPath ? `https://image.tmdb.org/t/p/w342${this.posterPath}` : '',
    });
  }

  private buscarLogo(): void {
    this.movies
      .getLogoUrl(this.id, this.tipo)
      .pipe(takeUntil(this.trocou$), takeUntil(this.destroy$))
      .subscribe((url) => this.logoUrl.set(url));
  }
}
