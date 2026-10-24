import { Component, HostListener, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucidePlus, LucideSearch, LucideX } from '@lucide/angular';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, takeUntil } from 'rxjs';
import { TituloBusca, filmeParaTitulo, serieParaTitulo } from '../../../core/busca/busca';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { Midia } from '../../../core/models/catalogo.models';
import { Movie, TvShow } from '../../../core/models/tmdb.models';
import { MovieService } from '../../../core/services/movie.service';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { MediaFallbackComponent } from '../../../shared/components/media-fallback/media-fallback.component';

const MAXIMO = 4;

@Component({
  selector: 'app-favoritos-modal',
  standalone: true,
  imports: [MediaFallbackComponent, LucideX, LucideSearch, LucidePlus, LucideChevronLeft, LucideChevronRight],
  templateUrl: './favoritos-modal.component.html',
})
export class FavoritosModalComponent implements OnInit, OnDestroy {
  private readonly movieService = inject(MovieService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly smoothScroll = inject(SmoothScrollService);

  readonly atuais = input<Midia[]>([]);
  readonly fechou = output<void>();
  readonly salvou = output<Midia[]>();

  readonly maximo = MAXIMO;
  readonly escolhidos = signal<TituloBusca[]>([]);
  readonly termo = signal('');
  readonly resultados = signal<TituloBusca[]>([]);
  readonly buscando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal('');
  readonly vagas = computed(() => Array.from({ length: MAXIMO - this.escolhidos().length }, (_, i) => i));

  private busca$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor() {
    this.smoothScroll.stop();
  }

  ngOnInit(): void {
    this.escolhidos.set(
      this.atuais().map((m) => ({
        id: m.tmdbId,
        tipo: m.type === 'MOVIE' ? 'movies' : 'series',
        titulo: m.title,
        partes: [],
        ano: m.releaseDate?.slice(0, 4) ?? '',
        posterPath: m.posterPath,
      })),
    );

    this.busca$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((texto) => {
          const termo = texto.trim();
          if (!termo) return of([]);
          this.buscando.set(true);
          return this.movieService.searchMulti(termo).pipe(
            map((res) =>
              res.results
                .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
                .slice(0, 8)
                .map((r) =>
                  r.media_type === 'movie' ? filmeParaTitulo(r as Movie, termo) : serieParaTitulo(r as TvShow, termo),
                ),
            ),
            catchError(() => of([])),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((lista) => {
        this.resultados.set(lista);
        this.buscando.set(false);
      });
  }

  ngOnDestroy(): void {
    this.smoothScroll.start();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  fechar(): void {
    if (!this.salvando()) this.fechou.emit();
  }

  digitar(valor: string): void {
    this.termo.set(valor);
    this.busca$.next(valor);
  }

  jaEscolhido(titulo: TituloBusca): boolean {
    return this.escolhidos().some((e) => e.id === titulo.id && e.tipo === titulo.tipo);
  }

  escolher(titulo: TituloBusca): void {
    if (this.jaEscolhido(titulo) || this.escolhidos().length >= MAXIMO) return;
    this.escolhidos.update((lista) => [...lista, titulo]);
  }

  tirar(indice: number): void {
    this.escolhidos.update((lista) => lista.filter((_, i) => i !== indice));
  }

  // o primeiro vira a capa do perfil: a ordem importa
  mover(indice: number, passo: -1 | 1): void {
    const alvo = indice + passo;
    if (alvo < 0 || alvo >= this.escolhidos().length) return;
    this.escolhidos.update((lista) => {
      const nova = [...lista];
      [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
      return nova;
    });
  }

  salvar(): void {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set('');

    this.usuarioService
      .definirFavoritos(
        this.escolhidos().map((e) => ({ tmdbId: e.id, mediaType: e.tipo === 'movies' ? 'movie' : 'tv' })),
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (midias) => {
          this.salvando.set(false);
          this.salvou.emit(midias);
        },
        error: (falha) => {
          this.salvando.set(false);
          this.erro.set(mensagemDeErro(falha));
        },
      });
  }

  posterUrl(caminho: string | null): string {
    return this.movieService.getImageUrl(caminho, 'w185');
  }
}
