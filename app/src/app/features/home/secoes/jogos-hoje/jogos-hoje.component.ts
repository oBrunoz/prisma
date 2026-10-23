import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideLock, LucidePlay } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { ESPECTRO } from '../../../../core/models/espectro';
import { DesafiosDoDia, InfoJogo, JOGOS, Partida, tentativasUsadas } from '../../../../core/models/jogos.models';
import { AuthService } from '../../../../core/services/auth.service';
import { JogosService } from '../../../../core/services/jogos.service';
import { CarouselRowComponent } from '../../../../shared/components/carousel-row/carousel-row.component';
import { CapaJogoComponent } from '../../../jogos/palcos/capa-jogo/capa-jogo.component';

interface CardJogo {
  info: InfoJogo;
  partida: Partida;
  fim: boolean;
  // só com conta e deslogado: o card abre o convite
  trancado: boolean;
  fios: { cor: string; gasto: boolean; vazio: boolean }[];
  status: string;
  botao: string;
}

// os jogos do dia na home, numa fileira, com o andamento de cada um; some se não houver desafio.
// Nasce com o esqueleto da fileira para a altura não mudar quando o dia chega
@Component({
  selector: 'app-jogos-hoje',
  standalone: true,
  imports: [RouterLink, LucideArrowRight, LucideLock, LucidePlay, CarouselRowComponent, CapaJogoComponent],
  templateUrl: './jogos-hoje.component.html',
  styleUrls: ['./jogos-hoje.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JogosHojeComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly jogos = inject(JogosService);
  private readonly destroy$ = new Subject<void>();

  readonly esqueleto = Array.from({ length: 5 }, (_, i) => i);
  readonly dia = signal<DesafiosDoDia | null>(null);
  readonly carregado = signal(false);

  // os que faltam primeiro: quem já jogou um vê o próximo logo de cara
  readonly cards = computed(() =>
    JOGOS.flatMap((info): CardJogo[] => {
      const partida = this.dia()?.challenges.find((c) => c.kind === info.tipo);
      if (!partida) return [];
      const usados = tentativasUsadas(partida);
      const fim = partida.status !== 'PLAYING';
      const erros = partida.status === 'WON' ? usados - 1 : usados;
      const trancado = !!info.soComConta && !this.auth.autenticado();
      return [
        {
          info,
          partida,
          fim,
          trancado,
          fios: ESPECTRO.map((cor, k) => ({ cor, gasto: k < erros && !info.porPlacar, vazio: !usados })),
          status: trancado
            ? 'Só com conta'
            : info.porPlacar && fim
              ? info.acerto(partida.score ?? 0)
              : partida.status === 'WON'
                ? info.acerto(usados)
                : partida.status === 'LOST'
                  ? 'Ficou para amanhã'
                  : usados
                    ? `${usados} de ${partida.attempts}`
                    : info.regra,
          botao: trancado ? 'Entrar' : fim ? 'Resultado' : usados ? 'Continuar' : 'Jogar',
        },
      ];
    }).sort((a, b) => Number(a.fim) - Number(b.fim)),
  );

  // o dia é pequeno e decide se a seção existe: vem logo na abertura, com a pessoa ainda no destaque
  constructor() {
    this.jogos
      .hoje()
      .pipe(takeUntil(this.destroy$))
      // sem o dia, a seção só não aparece
      .subscribe({
        next: (dia) => this.dia.set(dia),
        error: () => {
          this.dia.set(null);
          this.carregado.set(true);
        },
        complete: () => this.carregado.set(true),
      });
  }

  pedirConta(card: CardJogo): void {
    this.auth.pedirLogin(`Entre para jogar ${card.info.nome}`);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
