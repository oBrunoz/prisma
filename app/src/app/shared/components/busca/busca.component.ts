import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { LucideArrowRight, LucideClock, LucideSearch, LucideX } from '@lucide/angular';
import { Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, takeUntil } from 'rxjs';
import {
  PessoaBusca,
  TituloBusca,
  filmeParaTitulo,
  pessoaParaBusca,
  serieParaTitulo,
  trechos,
} from '../../../core/busca/busca';
import { BuscasRecentesService } from '../../../core/busca/buscas-recentes.service';
import { UsuarioResumo } from '../../../core/models/auth.models';
import { Movie, Person, TvShow } from '../../../core/models/tmdb.models';
import { MovieService } from '../../../core/services/movie.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { MediaFallbackComponent } from '../media-fallback/media-fallback.component';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

interface Resultados {
  titulos: TituloBusca[];
  pessoas: PessoaBusca[];
  usuarios: UsuarioResumo[];
  falhou: boolean;
}

const VAZIO: Resultados = { titulos: [], pessoas: [], usuarios: [], falhou: false };

// a ordem das setas: pôsteres, depois elenco, depois usuários
type Navegavel = { rota: unknown[] };

@Component({
  selector: 'app-busca',
  standalone: true,
  imports: [
    NgClass,
    RouterModule,
    MediaFallbackComponent,
    UserAvatarComponent,
    LucideSearch,
    LucideX,
    LucideClock,
    LucideArrowRight,
  ],
  templateUrl: './busca.component.html',
})
export class BuscaComponent implements OnInit, OnDestroy {
  private readonly movieService = inject(MovieService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly recentes = inject(BuscasRecentesService);

  // a navbar recolhe a barra no celular quando a busca fecha vazia
  readonly recolher = output<void>();

  @ViewChild('campo') campo?: ElementRef<HTMLInputElement>;

  readonly termo = signal('');
  readonly aberta = signal(false);
  readonly carregando = signal(false);
  readonly resultados = signal<Resultados>(VAZIO);
  readonly emAlta = signal<TituloBusca[]>([]);
  readonly ativo = signal(-1);

  readonly digitado = computed(() => this.termo().trim());
  readonly soUsuarios = computed(() => this.digitado().startsWith('@'));
  readonly vazia = computed(() => this.digitado().replace(/^@/, '') === '');
  readonly semResultados = computed(() => {
    const r = this.resultados();
    return !r.falhou && r.titulos.length + r.pessoas.length + r.usuarios.length === 0;
  });

  private readonly navegaveis = computed<Navegavel[]>(() => {
    const r = this.resultados();
    return [
      ...r.titulos.map((t) => ({ rota: ['/search', t.tipo, t.id] })),
      ...r.pessoas.map((p) => ({ rota: ['/search', 'people', p.id] })),
      ...r.usuarios.map((u) => ({ rota: ['/username', u.username] })),
    ];
  });

  private busca$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private emAltaPedido = false;

  ngOnInit(): void {
    this.busca$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((texto) => {
          const termo = texto.trim();
          if (termo.replace(/^@/, '') === '') {
            this.carregando.set(false);
            return of(VAZIO);
          }
          this.carregando.set(true);
          return termo.startsWith('@') ? this.buscarUsuarios(termo.slice(1)) : this.buscarTudo(termo);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((resultados) => {
        this.resultados.set(resultados);
        this.carregando.set(false);
        this.ativo.set(-1);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  focar(): void {
    this.campo?.nativeElement.focus();
  }

  abrir(): void {
    this.aberta.set(true);
    this.carregarEmAlta();
  }

  fechar(): void {
    this.aberta.set(false);
    this.ativo.set(-1);
    if (!this.digitado()) this.recolher.emit();
  }

  limpar(): void {
    this.termo.set('');
    this.busca$.next('');
    this.resultados.set(VAZIO);
    this.ativo.set(-1);
  }

  digitar(valor: string): void {
    this.termo.set(valor);
    this.aberta.set(true);
    this.busca$.next(valor);
  }

  usarRecente(termo: string): void {
    this.digitar(termo);
    this.focar();
  }

  // clicou num resultado: guarda o termo e sai do caminho
  aoAbrir(): void {
    this.recentes.guardar(this.digitado());
    this.limpar();
    this.campo?.nativeElement.blur();
    this.fechar();
  }

  verTodos(): void {
    const termo = this.digitado();
    if (!termo) return;
    this.recentes.guardar(termo);
    this.router.navigate(['/busca'], { queryParams: { q: termo } });
    this.limpar();
    this.campo?.nativeElement.blur();
    this.fechar();
  }

  aoTeclar(evento: KeyboardEvent): void {
    const itens = this.navegaveis();

    if ((evento.key === 'ArrowDown' || evento.key === 'ArrowUp') && itens.length > 0) {
      evento.preventDefault();
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      this.ativo.set((this.ativo() + passo + itens.length) % itens.length);
      this.host.nativeElement
        .querySelector(`[data-indice="${this.ativo()}"]`)
        ?.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (evento.key === 'Enter') {
      evento.preventDefault();
      const escolhido = itens[this.ativo()];
      if (escolhido) {
        this.router.navigate(escolhido.rota);
        this.aoAbrir();
      } else {
        this.verTodos();
      }
    }

    if (evento.key === 'Escape') {
      this.campo?.nativeElement.blur();
      this.fechar();
    }
  }

  // o painel fica no próprio componente: clique fora dele fecha
  @HostListener('document:pointerdown', ['$event'])
  aoTocarFora(evento: PointerEvent): void {
    if (!this.aberta()) return;
    if (!this.host.nativeElement.contains(evento.target as Node)) this.fechar();
  }

  posterUrl(caminho: string | null): string {
    return this.movieService.getImageUrl(caminho, 'w185');
  }

  indiceDePessoa(i: number): number {
    return this.resultados().titulos.length + i;
  }

  indiceDeUsuario(i: number): number {
    const r = this.resultados();
    return r.titulos.length + r.pessoas.length + i;
  }

  partesDoUsername(usuario: UsuarioResumo) {
    return trechos(usuario.username, this.digitado().replace(/^@/, ''));
  }

  private buscarTudo(termo: string) {
    return forkJoin({
      tmdb: this.movieService.searchMulti(termo).pipe(catchError(() => of(null))),
      usuarios: this.usuarioService.buscar(termo, 1, 3).pipe(
        map((r) => r.resultados),
        catchError(() => of([] as UsuarioResumo[])),
      ),
    }).pipe(
      map(({ tmdb, usuarios }): Resultados => {
        const itens = tmdb?.results ?? [];
        return {
          titulos: itens
            .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
            .slice(0, 5)
            .map((r) =>
              r.media_type === 'movie'
                ? filmeParaTitulo(r as Movie, termo)
                : serieParaTitulo(r as TvShow, termo),
            ),
          pessoas: itens
            .filter((r) => r.media_type === 'person')
            .slice(0, 4)
            .map((r) => pessoaParaBusca(r as Person, termo)),
          usuarios,
          falhou: tmdb === null,
        };
      }),
    );
  }

  private buscarUsuarios(termo: string) {
    return this.usuarioService.buscar(termo, 1, 8).pipe(
      map((r): Resultados => ({ ...VAZIO, usuarios: r.resultados })),
      catchError(() => of({ ...VAZIO, falhou: true })),
    );
  }

  // só na primeira abertura; o MovieService guarda em cache
  private carregarEmAlta(): void {
    if (this.emAltaPedido) return;
    this.emAltaPedido = true;

    this.movieService
      .getTrendingMovies('week')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.emAlta.set(res.results.slice(0, 5).map((f) => filmeParaTitulo(f, ''))),
        error: () => (this.emAltaPedido = false),
      });
  }
}
