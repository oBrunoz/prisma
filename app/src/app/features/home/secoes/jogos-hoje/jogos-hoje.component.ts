import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucidePlay } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ESPECTRO } from '../../../../core/models/espectro';
import { DesafiosDoDia, JOGOS } from '../../../../core/models/jogos.models';
import { AuthService } from '../../../../core/services/auth.service';
import { JogosService } from '../../../../core/services/jogos.service';
import { PosterListrasComponent } from '../../../../shared/components/poster-listras/poster-listras.component';
import { AparecerDirective } from '../../../../shared/directives/aparecer.directive';

// os dois jogos do dia na home, com o andamento de cada um; some se não houver desafio
@Component({
  selector: 'app-jogos-hoje',
  standalone: true,
  imports: [RouterLink, LucideArrowRight, LucidePlay, PosterListrasComponent, AparecerDirective],
  templateUrl: './jogos-hoje.component.html',
  styleUrls: ['./jogos-hoje.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JogosHojeComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly jogos = inject(JogosService);
  private readonly destroy$ = new Subject<void>();

  readonly imagens = environment.tmdbImageUrl;
  readonly dia = signal<DesafiosDoDia | null>(null);

  readonly cards = computed(() =>
    JOGOS.flatMap((info) => {
      const partida = this.dia()?.challenges.find((c) => c.kind === info.tipo);
      if (!partida) return [];
      const usados = partida.guesses.length;
      const fim = partida.status !== 'PLAYING';
      const erros = partida.status === 'WON' ? usados - 1 : usados;
      return [
        {
          info,
          partida,
          fim,
          fios: ESPECTRO.map((cor, k) => ({ cor, gasto: k < erros, vazio: !usados })),
          status:
            partida.status === 'WON'
              ? info.acerto(usados)
              : partida.status === 'LOST'
                ? 'Ficou para amanhã'
                : usados
                  ? `${usados + 1} de ${partida.attempts}`
                  : info.regra,
          botao: fim ? 'Resultado' : usados ? 'Continuar' : 'Jogar',
        },
      ];
    }),
  );

  readonly jogouAlgum = computed(() => (this.dia()?.challenges ?? []).some((c) => c.guesses.length));

  carregar(): void {
    this.jogos
      .hoje()
      .pipe(takeUntil(this.destroy$))
      // sem o dia, a seção só não aparece
      .subscribe({ next: (dia) => this.dia.set(dia), error: () => this.dia.set(null) });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
