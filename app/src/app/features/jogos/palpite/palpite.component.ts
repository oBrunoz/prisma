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
import { MovieService } from '../../../core/services/movie.service';

export interface Opcao {
  tmdbId: number;
  title: string;
  year: number | null;
}

const MAXIMO = 6;

// o palpite: busca de filmes da TMDB; a resposta é conferida pelo id, não pelo texto
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

  @Output() chutar = new EventEmitter<Opcao>();
  @Output() pular = new EventEmitter<void>();

  @ViewChild('campo', { static: true }) private campo!: ElementRef<HTMLInputElement>;

  private readonly filmes = inject(MovieService);
  private readonly termo$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly texto = signal('');
  readonly opcoes = signal<Opcao[]>([]);
  readonly aberta = signal(false);
  readonly ativa = signal(0);
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
          return this.filmes.searchMovies(t).pipe(
            map((res) =>
              res.results
                .filter((f) => !this.excluir.includes(f.id))
                .slice(0, MAXIMO)
                .map((f) => ({
                  tmdbId: f.id,
                  title: f.title,
                  year: f.release_date ? Number(f.release_date.slice(0, 4)) : null,
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
        this.ativa.set(0);
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
      const passo = evento.key === 'ArrowDown' ? 1 : -1;
      this.ativa.set((this.ativa() + passo + opcoes.length) % opcoes.length);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      this.escolher(opcoes[this.ativa()]);
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
