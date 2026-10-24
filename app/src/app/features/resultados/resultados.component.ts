import { Component, OnDestroy, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';
import { Observable, Subject, map, takeUntil } from 'rxjs';
import { PessoaBusca, TituloBusca, filmeParaTitulo, pessoaParaBusca, serieParaTitulo } from '../../core/busca/busca';
import { mensagemDeErro } from '../../core/errors/mensagens';
import { UsuarioResumo } from '../../core/models/auth.models';
import { TmdbListResponse } from '../../core/models/tmdb.models';
import { MovieService } from '../../core/services/movie.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { LinhaUsuarioComponent } from '../../shared/components/linha-usuario/linha-usuario.component';
import { MediaFallbackComponent } from '../../shared/components/media-fallback/media-fallback.component';
import { MovieCardComponent } from '../../shared/components/movie-card/movie-card.component';
import { CarouselRowComponent } from '../../shared/components/carousel-row/carousel-row.component';

export type TipoResultado = 'tudo' | 'filmes' | 'series' | 'elenco' | 'usuarios';
type TipoLista = Exclude<TipoResultado, 'tudo'>;

interface Pagina<T> {
  itens: T[];
  total: number;
  temMais: boolean;
}

interface Lista<T> extends Pagina<T> {
  pagina: number;
  carregando: boolean;
  erro: string;
}

const ABAS: { tipo: TipoResultado; rotulo: string }[] = [
  { tipo: 'tudo', rotulo: 'Tudo' },
  { tipo: 'filmes', rotulo: 'Filmes' },
  { tipo: 'series', rotulo: 'Séries' },
  { tipo: 'elenco', rotulo: 'Elenco e equipe' },
  { tipo: 'usuarios', rotulo: 'Usuários' },
];

const USUARIOS_POR_PAGINA = 20;

function daTmdb<T, I>(pedido: Observable<TmdbListResponse<T>>, converter: (item: T) => I): Observable<Pagina<I>> {
  return pedido.pipe(
    map((r) => ({ itens: r.results.map(converter), total: r.total_results, temMais: r.page < r.total_pages })),
  );
}

const nova = <T,>(): Lista<T> => ({ itens: [], total: 0, temMais: false, pagina: 0, carregando: true, erro: '' });

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [NgTemplateOutlet, RouterModule, MovieCardComponent, CarouselRowComponent, MediaFallbackComponent, LinhaUsuarioComponent, LucideArrowRight],
  templateUrl: './resultados.component.html',
})
export class ResultadosComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly movieService = inject(MovieService);
  private readonly usuarioService = inject(UsuarioService);

  readonly abas = ABAS;

  readonly termo = signal('');
  readonly tipo = signal<TipoResultado>('tudo');

  readonly filmes = signal<Lista<TituloBusca>>(nova());
  readonly series = signal<Lista<TituloBusca>>(nova());
  readonly elenco = signal<Lista<PessoaBusca>>(nova());
  readonly usuarios = signal<Lista<UsuarioResumo>>(nova());

  readonly carregandoTudo = computed(() =>
    [this.filmes(), this.series(), this.elenco(), this.usuarios()].some((l) => l.carregando && l.pagina === 0),
  );

  readonly nadaEncontrado = computed(
    () =>
      !this.carregandoTudo() &&
      [this.filmes(), this.series(), this.elenco(), this.usuarios()].every((l) => l.total === 0 && !l.erro),
  );

  private destroy$ = new Subject<void>();
  private trocaDeTermo$ = new Subject<void>();

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const bruto = (params.get('q') ?? '').trim();
      // "@ana" é o atalho da busca para usuários
      const soUsuarios = bruto.startsWith('@');
      const termo = bruto.replace(/^@/, '').trim();
      const tipo = (params.get('tipo') as TipoResultado | null) ?? (soUsuarios ? 'usuarios' : 'tudo');

      this.tipo.set(ABAS.some((a) => a.tipo === tipo) ? tipo : 'tudo');

      if (termo !== this.termo()) {
        this.termo.set(termo);
        this.recomecar();
      }
    });
  }

  ngOnDestroy(): void {
    this.trocaDeTermo$.next();
    this.trocaDeTermo$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  trocarAba(tipo: TipoResultado): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tipo: tipo === 'tudo' ? null : tipo },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  total(tipo: TipoResultado): number | null {
    if (tipo === 'tudo') return null;
    const lista = this.lista(tipo)();
    return lista.pagina === 0 ? null : lista.total;
  }

  carregarMais(tipo: TipoLista): void {
    const lista = this.lista(tipo)();
    if (lista.carregando) return;
    this.carregar(tipo, lista.pagina + 1);
  }

  posterUrl(caminho: string | null): string {
    return this.movieService.getImageUrl(caminho, 'w185');
  }

  private recomecar(): void {
    this.trocaDeTermo$.next();
    for (const tipo of ['filmes', 'series', 'elenco', 'usuarios'] as TipoLista[]) {
      this.lista(tipo).set(nova());
      if (this.termo()) this.carregar(tipo, 1);
    }
  }

  private carregar(tipo: TipoLista, pagina: number): void {
    const sinal = this.lista(tipo);
    sinal.update((l) => ({ ...l, carregando: true, erro: '' }));

    this.pedir(tipo, pagina)
      .pipe(takeUntil(this.trocaDeTermo$), takeUntil(this.destroy$))
      .subscribe({
        next: (res) =>
          sinal.update((l) => ({
            ...l,
            itens: pagina === 1 ? res.itens : [...l.itens, ...res.itens],
            total: res.total,
            temMais: res.temMais,
            pagina,
            carregando: false,
          })),
        error: (falha) => sinal.update((l) => ({ ...l, carregando: false, erro: mensagemDeErro(falha) })),
      });
  }

  private pedir(tipo: TipoLista, pagina: number): Observable<Pagina<unknown>> {
    const termo = this.termo();

    if (tipo === 'usuarios') {
      return this.usuarioService.buscar(termo, pagina, USUARIOS_POR_PAGINA).pipe(
        map((r) => ({
          itens: r.resultados,
          total: r.total,
          temMais: pagina * USUARIOS_POR_PAGINA < r.total,
        })),
      );
    }

    if (tipo === 'filmes') {
      return daTmdb(this.movieService.searchMovies(termo, pagina), (f) => filmeParaTitulo(f, termo));
    }
    if (tipo === 'series') {
      return daTmdb(this.movieService.searchTv(termo, pagina), (t) => serieParaTitulo(t, termo));
    }
    return daTmdb(this.movieService.searchPeople(termo, pagina), (p) => pessoaParaBusca(p, termo));
  }

  private lista(tipo: TipoLista): WritableSignal<Lista<unknown>> {
    const listas = { filmes: this.filmes, series: this.series, elenco: this.elenco, usuarios: this.usuarios };
    return listas[tipo] as unknown as WritableSignal<Lista<unknown>>;
  }
}
