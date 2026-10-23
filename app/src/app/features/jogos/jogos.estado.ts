import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../core/errors/mensagens';
import { DesafiosDoDia, Partida, TipoJogo, jogoPorTipo } from '../../core/models/jogos.models';
import { JogosService } from '../../core/services/jogos.service';
import { ToastService } from '../../core/services/toast.service';

// o servidor aceita até 50; os mais antigos saem primeiro
const LEMBRAR_SORTEADOS = 40;

// o dia carregado uma vez para a escolha e as partidas; vive enquanto a aba está aberta
@Injectable()
export class JogosEstado implements OnDestroy {
  private readonly jogos = inject(JogosService);
  private readonly toast = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  readonly dia = signal<DesafiosDoDia | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  // a abertura da janela terminou (ou foi pulada)
  readonly atravessou = signal(false);

  // fora do diário: um desafio antigo por jogo, só na memória
  readonly sorteadas = signal<Partial<Record<TipoJogo, Partida>>>({});
  readonly sorteando = signal(false);
  readonly erroDoSorteio = signal<string | null>(null);
  private readonly jaSorteados: Partial<Record<TipoJogo, string[]>> = {};

  readonly numerosDeHoje = computed(() => {
    const numeros: Partial<Record<TipoJogo, number>> = {};
    for (const c of this.dia()?.challenges ?? []) numeros[c.kind] = c.number;
    return numeros;
  });

  partida(tipo: TipoJogo): Partida | null {
    return this.dia()?.challenges.find((c) => c.kind === tipo) ?? null;
  }

  sorteada(tipo: TipoJogo): Partida | null {
    return this.sorteadas()[tipo] ?? null;
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

  sortear(tipo: TipoJogo): void {
    if (this.sorteando()) return;
    this.sorteando.set(true);
    this.erroDoSorteio.set(null);
    this.jogos
      .sortear(tipo, this.jaSorteados[tipo] ?? [])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ challenge, repeated }) => {
          this.sorteando.set(false);
          const lista = (this.jaSorteados[tipo] ?? []).filter((id) => id !== challenge.id);
          this.jaSorteados[tipo] = [...lista, challenge.id].slice(-LEMBRAR_SORTEADOS);
          this.sorteadas.update((s) => ({ ...s, [tipo]: challenge }));
          if (repeated) {
            this.toast.info(`Você já viu todos os desafios antigos de ${jogoPorTipo(tipo).nome}`, {
              detalhe: 'Este é repetido. Todo dia entra mais um na lista.',
              chave: 'jogos-sorteio',
            });
          }
        },
        error: (e) => {
          this.sorteando.set(false);
          // com uma partida na tela o erro vira aviso; sem nada, fica na página
          if (this.sorteada(tipo)) {
            this.toast.erro('Não deu para sortear outro desafio', { detalhe: mensagemDeErro(e), chave: 'jogos-sorteio' });
          } else {
            this.erroDoSorteio.set(mensagemDeErro(e));
          }
        },
      });
  }

  atualizar(partida: Partida): void {
    this.dia.update((dia) =>
      dia ? { ...dia, challenges: dia.challenges.map((c) => (c.id === partida.id ? partida : c)) } : dia,
    );
    this.sorteadas.update((s) => (s[partida.kind]?.id === partida.id ? { ...s, [partida.kind]: partida } : s));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
