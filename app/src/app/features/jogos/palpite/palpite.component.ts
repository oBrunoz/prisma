import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { LucideSearch, LucideSkipForward } from '@lucide/angular';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, takeUntil } from 'rxjs';
import { Movie, Person } from '../../../core/models/tmdb.models';
import { MovieService } from '../../../core/services/movie.service';

export interface Opcao {
  tmdbId: number;
  title: string;
  year: number | null;
  // título original, só quando difere do traduzido
  original: string | null;
}

const MAXIMO = 6;
// abaixo disso a TMDB devolve curta, rascunho e cadastro duplicado
const VOTOS_MINIMOS = 10;

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// 0 igual · 1 começa igual · 2 cada palavra digitada abre uma palavra do título · 3 contém · 4 só a TMDB achou
function aderencia(termo: string, titulo: string): number {
  const t = normalizar(titulo);
  if (t === termo) return 0;
  if (t.startsWith(termo)) return 1;
  const palavras = t.split(' ');
  if (termo.split(' ').every((p) => palavras.some((w) => w.startsWith(p)))) return 2;
  return t.includes(termo) ? 3 : 4;
}

// reordena o que a TMDB devolve: quem bate com o que foi digitado primeiro, depois o mais votado
function ordenar(termo: string, filmes: Movie[]): Movie[] {
  const q = normalizar(termo);
  return filmes
    .map((f) => ({ f, nota: Math.min(aderencia(q, f.title), aderencia(q, f.original_title ?? '')) }))
    .filter(({ f, nota }) => f.release_date && (f.vote_count >= VOTOS_MINIMOS || nota <= 1))
    .sort((a, b) => a.nota - b.nota || b.f.vote_count - a.f.vote_count)
    .map(({ f }) => f);
}

const OFICIOS: Record<string, string> = {
  Directing: 'Direção',
  Acting: 'Atuação',
  Writing: 'Roteiro',
  Production: 'Produção',
  Camera: 'Fotografia',
  Editing: 'Montagem',
  Sound: 'Som',
};

// pessoa: a mesma régua do filme, sem corte por votos (a TMDB já devolve pela fama)
function ordenarPessoas(termo: string, pessoas: Person[]): Person[] {
  const q = normalizar(termo);
  return pessoas
    .map((p, i) => ({ p, i, nota: aderencia(q, p.name) }))
    .filter(({ nota }) => nota < 4)
    .sort((a, b) => a.nota - b.nota || a.i - b.i)
    .map(({ p }) => p);
}

// o palpite: busca de filmes (ou de pessoas) da TMDB; a resposta é conferida pelo id, não pelo texto
@Component({
  selector: 'app-palpite',
  standalone: true,
  imports: [LucideSearch, LucideSkipForward],
  templateUrl: './palpite.component.html',
  styleUrls: ['./palpite.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PalpiteComponent implements OnInit, OnDestroy {
  // ids já chutados não aparecem de novo
  @Input() excluir: number[] = [];
  @Input() desabilitado = false;
  // assinatura: o palpite é quem dirigiu
  @Input() modo: 'filme' | 'pessoa' = 'filme';

  @Output() chutar = new EventEmitter<Opcao>();
  @Output() pular = new EventEmitter<void>();

  @ViewChild('campo', { static: true }) private campo!: ElementRef<HTMLInputElement>;

  private readonly filmes = inject(MovieService);
  private readonly termo$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly texto = signal('');
  readonly opcoes = signal<Opcao[]>([]);
  readonly aberta = signal(false);
  // -1: nada destacado até a pessoa usar as setas ou o mouse
  readonly ativa = signal(-1);
  readonly buscando = signal(false);
  readonly escolhida = signal<Opcao | null>(null);
  // pisca o campo em coral quando o palpite erra
  readonly errou = signal(false);

  ngOnInit(): void {
    this.termo$
      .pipe(
        map((t) => t.trim()),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((t) => {
          if (t.length < 2) return of([] as Opcao[]);
          this.buscando.set(true);
          if (this.modo === 'pessoa') {
            return this.filmes.searchPeople(t).pipe(
              map((res) =>
                ordenarPessoas(t, res.results)
                  .filter((p) => !this.excluir.includes(p.id))
                  .slice(0, MAXIMO)
                  .map((p) => ({
                    tmdbId: p.id,
                    title: p.name,
                    year: null,
                    original: OFICIOS[p.known_for_department] ?? null,
                  })),
              ),
              catchError(() => of([] as Opcao[])),
            );
          }
          return this.filmes.searchMovies(t).pipe(
            map((res) =>
              ordenar(t, res.results)
                .filter((f) => !this.excluir.includes(f.id))
                .slice(0, MAXIMO)
                .map((f) => ({
                  tmdbId: f.id,
                  title: f.title,
                  year: f.release_date ? Number(f.release_date.slice(0, 4)) : null,
                  original:
                    f.original_title && normalizar(f.original_title) !== normalizar(f.title)
                      ? f.original_title
                      : null,
                })),
            ),
            catchError(() => of([] as Opcao[])),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((opcoes) => {
        this.buscando.set(false);
        this.opcoes.set(opcoes);
        this.ativa.set(-1);
        this.aberta.set(this.texto().trim().length >= 2);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  focar(): void {
    this.campo.nativeElement.focus({ preventScroll: true });
  }

  sinalizarErro(): void {
    this.errou.set(false);
    requestAnimationFrame(() => this.errou.set(true));
  }

  aoDigitar(valor: string): void {
    this.texto.set(valor);
    this.escolhida.set(null);
    if (valor.trim().length < 2) this.aberta.set(false);
    this.termo$.next(valor);
  }

  aoTeclar(evento: KeyboardEvent): void {
    const opcoes = this.opcoes();
    if (evento.key === 'Escape' && this.aberta()) {
      evento.stopPropagation();
      this.aberta.set(false);
      return;
    }
    if (!this.aberta() || !opcoes.length) return;
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      const atual = this.ativa();
      const proxima = evento.key === 'ArrowDown' ? atual + 1 : atual < 0 ? opcoes.length - 1 : atual - 1;
      this.ativa.set((proxima + opcoes.length) % opcoes.length);
    } else if (evento.key === 'Enter') {
      // Enter sem nada destacado não escolhe por conta própria
      evento.preventDefault();
      const opcao = opcoes[this.ativa()];
      if (opcao) this.escolher(opcao);
    }
  }

  escolher(opcao: Opcao): void {
    this.escolhida.set(opcao);
    this.texto.set(opcao.title);
    this.campo.nativeElement.value = opcao.title;
    this.aberta.set(false);
    this.focar();
  }

  enviar(evento: Event): void {
    evento.preventDefault();
    const opcao = this.escolhida();
    if (!opcao || this.desabilitado) return;
    this.chutar.emit(opcao);
    this.limpar();
  }

  aoPular(): void {
    if (this.desabilitado) return;
    this.pular.emit();
    this.limpar();
  }

  fecharDepois(): void {
    setTimeout(() => this.aberta.set(false), 120);
  }

  private limpar(): void {
    this.escolhida.set(null);
    this.texto.set('');
    this.opcoes.set([]);
    this.campo.nativeElement.value = '';
    this.termo$.next('');
  }
}
