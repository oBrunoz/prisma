import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { LucideSearch } from '@lucide/angular';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, takeUntil } from 'rxjs';
import { TituloBusca, filmeParaTitulo, serieParaTitulo } from '../../../../core/busca/busca';
import { mensagemDeErro } from '../../../../core/errors/mensagens';
import { Capa, FOCO_PADRAO, FocoCapa, TipoDeCapa } from '../../../../core/models/auth.models';
import { Midia } from '../../../../core/models/catalogo.models';
import { Movie, TvShow } from '../../../../core/models/tmdb.models';
import { AuthService } from '../../../../core/services/auth.service';
import { MovieService } from '../../../../core/services/movie.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UsuarioService } from '../../../../core/services/usuario.service';
import { MediaFallbackComponent } from '../../../../shared/components/media-fallback/media-fallback.component';
import { StripesBannerComponent } from '../../../../shared/components/stripes-banner/stripes-banner.component';
import { EnquadrarCapaComponent } from '../enquadrar-capa/enquadrar-capa.component';

interface Cena {
  titulo: TituloBusca;
  backdropPath: string;
}

const mesmoFoco = (a: FocoCapa, b: FocoCapa) => a.x === b.x && a.y === b.y && a.zoom === b.zoom;

const OPCOES: { tipo: TipoDeCapa; rotulo: string }[] = [
  { tipo: 'favorito', rotulo: 'Primeiro favorito' },
  { tipo: 'titulo', rotulo: 'Cena de um título' },
  { tipo: 'nenhuma', rotulo: 'Sem capa' },
];

@Component({
  selector: 'app-escolher-capa',
  standalone: true,
  imports: [MediaFallbackComponent, StripesBannerComponent, EnquadrarCapaComponent, LucideSearch],
  templateUrl: './escolher-capa.component.html',
})
export class EscolherCapaComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly movieService = inject(MovieService);
  private readonly toast = inject(ToastService);

  readonly opcoes = OPCOES;

  readonly carregando = signal(true);
  readonly salva = signal<Capa | null>(null);
  readonly primeiroFavorito = signal<Midia | null>(null);

  readonly tipo = signal<TipoDeCapa>('favorito');
  readonly cena = signal<Cena | null>(null);
  readonly foco = signal<FocoCapa>(FOCO_PADRAO);

  readonly termo = signal('');
  readonly resultados = signal<TituloBusca[]>([]);
  readonly buscando = signal(false);
  readonly tituloAberto = signal<TituloBusca | null>(null);
  readonly cenas = signal<string[]>([]);
  readonly carregandoCenas = signal(false);

  readonly salvando = signal(false);
  readonly previaUrl = signal<string | null>(null);

  readonly mudou = computed(() => {
    const salva = this.salva();
    if (!salva) return false;
    const tipo = this.tipo();
    const cena = this.cena();
    if (tipo !== salva.tipo) return tipo !== 'titulo' || !!cena;
    if (tipo === 'titulo' && cena && cena.backdropPath !== salva.backdropPath) return true;
    return tipo !== 'nenhuma' && !mesmoFoco(this.foco(), salva.foco);
  });

  private busca$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    const username = this.auth.usuario()?.username;
    if (!username) return;

    this.usuarioService
      .perfil(username)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (perfil) => {
          this.salva.set(perfil.capa);
          this.primeiroFavorito.set(perfil.favoritos[0] ?? null);
          this.tipo.set(perfil.capa.tipo);
          this.foco.set(perfil.capa.foco);
          if (perfil.capa.tipo === 'titulo' && perfil.capa.media && perfil.capa.backdropPath) {
            this.cena.set({ titulo: this.deMidia(perfil.capa.media), backdropPath: perfil.capa.backdropPath });
          }
          this.carregando.set(false);
          this.atualizarPrevia();
        },
        error: () => this.carregando.set(false),
      });

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
                .slice(0, 6)
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
    this.destroy$.next();
    this.destroy$.complete();
  }

  escolherTipo(tipo: TipoDeCapa): void {
    this.tipo.set(tipo);
    this.foco.set(this.focoDaCena());
    this.atualizarPrevia();
  }

  digitar(valor: string): void {
    this.termo.set(valor);
    this.tituloAberto.set(null);
    this.busca$.next(valor);
  }

  abrirTitulo(titulo: TituloBusca): void {
    this.tituloAberto.set(titulo);
    this.cenas.set([]);
    this.carregandoCenas.set(true);

    this.movieService
      .getBackdrops(titulo.id, titulo.tipo === 'movies' ? 'movie' : 'tv')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cenas) => {
          this.cenas.set(cenas.slice(0, 12));
          this.carregandoCenas.set(false);
        },
        error: () => this.carregandoCenas.set(false),
      });
  }

  escolherCena(backdropPath: string): void {
    const titulo = this.tituloAberto();
    if (!titulo) return;
    this.cena.set({ titulo, backdropPath });
    this.foco.set(this.focoDaCena());
    this.atualizarPrevia();
  }

  salvar(): void {
    if (this.salvando() || !this.mudou()) return;
    const tipo = this.tipo();
    const cena = this.cena();

    this.salvando.set(true);
    this.usuarioService
      .definirCapa(
        tipo === 'titulo' && cena
          ? {
              tipo,
              tmdbId: cena.titulo.id,
              mediaType: cena.titulo.tipo === 'movies' ? 'movie' : 'tv',
              backdropPath: cena.backdropPath,
              foco: this.foco(),
            }
          : tipo === 'favorito'
            ? { tipo, foco: this.foco() }
            : { tipo },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (capa) => {
          this.salvando.set(false);
          this.salva.set(capa);
          this.toast.sucesso('Capa atualizada', { chave: 'capa' });
        },
        error: (falha) => {
          this.salvando.set(false);
          this.toast.erro('Não trocamos a capa', {
            detalhe: mensagemDeErro(falha, { 400: 'Essa imagem não está mais disponível. Escolha outra cena.' }),
            chave: 'capa',
          });
        },
      });
  }

  cenaUrl(caminho: string, tamanho = 'w300'): string {
    return this.movieService.getImageUrl(caminho, tamanho);
  }

  posterUrl(caminho: string | null): string {
    return this.movieService.getImageUrl(caminho, 'w92');
  }

  ehCenaEscolhida(caminho: string): boolean {
    return this.cena()?.backdropPath === caminho;
  }

  private focoDaCena(): FocoCapa {
    const salva = this.salva();
    if (!salva || this.tipo() !== salva.tipo || this.tipo() === 'nenhuma') return FOCO_PADRAO;
    if (this.tipo() === 'titulo' && this.cena()?.backdropPath !== salva.backdropPath) return FOCO_PADRAO;
    return salva.foco;
  }

  private atualizarPrevia(): void {
    const tipo = this.tipo();
    if (tipo === 'titulo') {
      const cena = this.cena();
      this.previaUrl.set(cena ? this.cenaUrl(cena.backdropPath, 'w1280') : null);
      return;
    }
    const favorito = this.primeiroFavorito();
    if (tipo === 'nenhuma' || !favorito) {
      this.previaUrl.set(null);
      return;
    }
    this.movieService
      .getBackdrop(favorito.tmdbId, favorito.type === 'MOVIE' ? 'movie' : 'tv')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (caminho) => {
          if (this.tipo() === 'favorito') this.previaUrl.set(caminho ? this.cenaUrl(caminho, 'w1280') : null);
        },
        error: () => this.previaUrl.set(null),
      });
  }

  private deMidia(midia: Midia): TituloBusca {
    return {
      id: midia.tmdbId,
      tipo: midia.type === 'MOVIE' ? 'movies' : 'series',
      titulo: midia.title,
      partes: [],
      ano: midia.releaseDate?.slice(0, 4) ?? '',
      posterPath: midia.posterPath,
    };
  }
}
