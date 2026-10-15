import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucidePlay } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ESPECTRO } from '../../../core/models/espectro';
import { EstatisticasJogo, JOGOS, TipoJogo } from '../../../core/models/jogos.models';
import { AuthService } from '../../../core/services/auth.service';
import { JogosService } from '../../../core/services/jogos.service';
import { JogosEstado } from '../jogos.estado';
import { dataPorExtenso, tempoAteAVirada } from '../jogos.util';
import { PosterListrasComponent } from '../poster-listras/poster-listras.component';

// a escolha do dia: os dois jogos lado a lado, com o andamento de cada um
@Component({
  selector: 'app-jogos-menu',
  standalone: true,
  imports: [RouterLink, LucidePlay, PosterListrasComponent],
  templateUrl: './jogos-menu.component.html',
  styleUrls: ['./jogos-menu.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JogosMenuComponent implements OnInit, OnDestroy {
  readonly estado = inject(JogosEstado);
  readonly auth = inject(AuthService);
  private readonly jogos = inject(JogosService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly espectro = ESPECTRO;
  readonly imagens = environment.tmdbImageUrl;
  readonly proximo = signal(tempoAteAVirada());
  readonly estatisticas = signal<Record<TipoJogo, EstatisticasJogo> | null>(null);
  private relogio = 0;

  readonly data = computed(() => {
    const dia = this.estado.dia()?.day;
    return dia ? dataPorExtenso(dia) : '';
  });

  readonly numero = computed(() => this.estado.dia()?.challenges[0]?.number ?? null);

  readonly cards = computed(() =>
    JOGOS.map((info, i) => {
      const partida = this.estado.partida(info.tipo);
      const usados = partida?.guesses.length ?? 0;
      const fim = partida ? partida.status !== 'PLAYING' : false;
      const erros = partida?.status === 'WON' ? usados - 1 : usados;
      return {
        info,
        tecla: String(i + 1),
        partida,
        fim,
        fios: ESPECTRO.map((cor, k) => ({ cor, gasto: k < erros, vazio: !usados })),
        status: !partida
          ? 'Sem desafio hoje'
          : partida.status === 'WON'
            ? `Acertou em ${usados}`
            : partida.status === 'LOST'
              ? 'Ficou para amanhã'
              : usados
                ? `${usados + 1} de ${partida.attempts}`
                : 'Não jogado',
        botao: fim ? 'Resultado' : usados ? 'Continuar' : 'Jogar',
        sequencia: this.estatisticas()?.[info.tipo]?.currentStreak ?? 0,
      };
    }),
  );

  constructor() {
    // as sequências dependem do número de hoje, que chega com o dia
    effect(() => {
      const numeros = this.estado.numerosDeHoje();
      if (!this.estado.dia()) return;
      untracked(() =>
        this.jogos
          .estatisticas(numeros)
          .pipe(takeUntil(this.destroy$))
          .subscribe({ next: (e) => this.estatisticas.set(e), error: () => this.estatisticas.set(null) }),
      );
    });
  }

  ngOnInit(): void {
    this.relogio = window.setInterval(() => this.proximo.set(tempoAteAVirada()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.relogio);
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    if (!this.estado.atravessou() || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const alvo = evento.target as HTMLElement | null;
    if (alvo?.closest('input, textarea, [contenteditable]')) return;
    const card = this.cards().find((c) => c.tecla === evento.key);
    if (card?.partida) this.router.navigate(['/jogos', card.info.slug]);
  }
}
