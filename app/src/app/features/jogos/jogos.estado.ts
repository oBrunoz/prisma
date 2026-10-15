import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../core/errors/mensagens';
import { DesafiosDoDia, Partida, TipoJogo } from '../../core/models/jogos.models';
import { JogosService } from '../../core/services/jogos.service';

// o dia carregado uma vez para a escolha e as partidas; vive enquanto a aba está aberta
@Injectable()
export class JogosEstado implements OnDestroy {
  private readonly jogos = inject(JogosService);
  private readonly destroy$ = new Subject<void>();

  readonly dia = signal<DesafiosDoDia | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  // a abertura da janela terminou (ou foi pulada)
  readonly atravessou = signal(false);

  readonly numerosDeHoje = computed(() => {
    const numeros: Partial<Record<TipoJogo, number>> = {};
    for (const c of this.dia()?.challenges ?? []) numeros[c.kind] = c.number;
    return numeros;
  });

  partida(tipo: TipoJogo): Partida | null {
    return this.dia()?.challenges.find((c) => c.kind === tipo) ?? null;
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);
    this.jogos
      .hoje()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dia) => {
          this.dia.set(dia);
          this.carregando.set(false);
        },
        error: (e) => {
          this.erro.set(mensagemDeErro(e));
          this.carregando.set(false);
        },
      });
  }

  atualizar(partida: Partida): void {
    this.dia.update((dia) =>
      dia ? { ...dia, challenges: dia.challenges.map((c) => (c.id === partida.id ? partida : c)) } : dia,
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
