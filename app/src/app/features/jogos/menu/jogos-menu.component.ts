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
import { LucideLock, LucidePlay, LucideShuffle } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { ESPECTRO } from '../../../core/models/espectro';
import { EstatisticasJogo, JOGOS, TipoJogo, tentativasUsadas } from '../../../core/models/jogos.models';
import { AuthService } from '../../../core/services/auth.service';
import { JogosService } from '../../../core/services/jogos.service';
import { JogosEstado } from '../jogos.estado';
import { dataPorExtenso, tempoAteAVirada } from '../jogos.util';
import { CapaJogoComponent } from '../palcos/capa-jogo/capa-jogo.component';

// teclas do 1 ao 0: os dez jogos, na ordem do menu
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

// a escolha do dia: os jogos lado a lado, com o andamento de cada um
@Component({
  selector: 'app-jogos-menu',
  standalone: true,
  imports: [RouterLink, LucideLock, LucidePlay, LucideShuffle, CapaJogoComponent],
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

  readonly proximo = signal(tempoAteAVirada());
  readonly estatisticas = signal<Partial<Record<TipoJogo, EstatisticasJogo>> | null>(null);
  private relogio = 0;

  readonly data = computed(() => {
    const dia = this.estado.dia()?.day;
    return dia ? dataPorExtenso(dia) : '';
  });

  readonly feitos = computed(() => (this.estado.dia()?.challenges ?? []).filter((c) => c.status !== 'PLAYING').length);
  readonly total = computed(() => this.estado.dia()?.challenges.length ?? 0);

  readonly cards = computed(() =>
    JOGOS.map((info, i) => {
      const partida = this.estado.partida(info.tipo);
      const usados = partida ? tentativasUsadas(partida) : 0;
      const fim = partida ? partida.status !== 'PLAYING' : false;
      const erros = partida?.status === 'WON' ? usados - 1 : usados;
      const trancado = !!partida && !!info.soComConta && !this.auth.autenticado();
      return {
        info,
        tecla: TECLAS[i],
        partida,
        fim,
        trancado,
        fios: ESPECTRO.map((cor, k) => ({ cor, gasto: k < erros && !info.porPlacar, vazio: !usados })),
        status: !partida
          ? 'Sem desafio hoje'
          : trancado
            ? 'Só com conta'
            : info.porPlacar && fim
            ? info.acerto(partida.score ?? 0)
            : partida.status === 'WON'
              ? info.acerto(usados)
              : partida.status === 'LOST'
                ? 'Ficou para amanhã'
                : usados
                  ? `${usados} de ${partida.attempts}`
                  : 'Não jogado',
        botao: trancado ? 'Entrar' : fim ? 'Resultado' : usados ? 'Continuar' : 'Jogar',
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

  // o aleatório é o que a conta destrava: deslogado, o convite sem sair da página
  jogarAleatorio(slug: string): void {
    if (!this.auth.autenticado()) {
      this.auth.pedirLogin('Crie uma conta para jogar desafios aleatórios');
      return;
    }
    this.router.navigate(['/jogos', slug, 'aleatorio']);
  }

  // os jogos mais legais pedem conta: deslogado, o convite sem sair da página
  pedirConta(nome: string): void {
    this.auth.pedirLogin(`Entre para jogar ${nome}`);
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    if (!this.estado.atravessou() || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const alvo = evento.target as HTMLElement | null;
    if (alvo?.closest('input, textarea, [contenteditable]')) return;
    const card = this.cards().find((c) => c.tecla === evento.key);
    if (card?.trancado) this.pedirConta(card.info.nome);
    else if (card?.partida) this.router.navigate(['/jogos', card.info.slug]);
  }
}
