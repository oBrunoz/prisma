import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { LucideDelete } from '@lucide/angular';
import { ConteudoLegenda, CorDaLetra, TENTATIVAS } from '../../../../core/models/jogos.models';
import { DicasComponent, TipoDeDica } from '../dicas/dicas.component';

const TECLAS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const PESO: Record<CorDaLetra, number> = { certo: 3, lugar: 2, ausente: 1 };
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Casa {
  l: string;
  cor: CorDaLetra | '';
  // letra dada por dica, de leve, até a pessoa digitar por cima
  dada: boolean;
  cheia: boolean;
  cursor: boolean;
}

// a legenda: a grade de sete linhas, o teclado (da tela e o físico) e as dicas
@Component({
  selector: 'app-legenda',
  standalone: true,
  imports: [LucideDelete, DicasComponent],
  templateUrl: './legenda.component.html',
  styleUrls: ['./legenda.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegendaComponent implements OnChanges {
  @Input({ required: true }) conteudo!: ConteudoLegenda;
  @Input() fim = false;
  @Input() ocupado = false;
  // a API recusou a palavra; cada recusa traz um número novo para o aviso tocar de novo
  @Input() recusa: { texto: string; vez: number } | null = null;

  @Output() palavra = new EventEmitter<string>();
  @Output() dica = new EventEmitter<TipoDeDica>();

  readonly teclas = TECLAS;
  readonly atual = signal('');
  readonly aviso = signal<{ texto: string; vez: number } | null>(null);
  readonly tremendo = signal(false);
  readonly virando = signal(-1);
  private readonly dados = signal<ConteudoLegenda | null>(null);

  readonly linhas = computed(() => {
    const c = this.dados();
    if (!c) return [];
    const atual = this.atual();
    const dadas = new Map<number, string>();
    for (const d of c.dicas) if (d.tipo === 'letra' && d.posicao !== undefined) dadas.set(d.posicao, d.valor);
    const vazia = (): Casa => ({ l: '', cor: '', dada: false, cheia: false, cursor: false });

    return Array.from({ length: TENTATIVAS }, (_, r) => {
      const feita = c.linhas[r];
      if (feita) {
        return { tipo: 'feita', casas: feita.letras.map((l, i): Casa => ({ ...vazia(), l, cor: feita.cores[i] })) };
      }
      if (r === c.linhas.length && !this.fim) {
        return {
          tipo: 'atual',
          casas: Array.from({ length: c.tamanho }, (_, i): Casa => {
            const digitada = atual[i]?.toUpperCase();
            return {
              ...vazia(),
              l: digitada ?? dadas.get(i) ?? '',
              dada: !digitada && dadas.has(i),
              cheia: !!digitada,
              cursor: i === atual.length,
            };
          }),
        };
      }
      return { tipo: 'vazia', casas: Array.from({ length: c.tamanho }, vazia) };
    });
  });

  // a tecla guarda a melhor informação que já se tem sobre a letra
  readonly cores = computed(() => {
    const c = this.dados();
    const melhor: Record<string, CorDaLetra> = {};
    for (const linha of c?.linhas ?? []) {
      linha.letras.forEach((l, i) => {
        const k = semAcento(l);
        const cor = linha.cores[i];
        if (!melhor[k] || PESO[cor] > PESO[melhor[k]]) melhor[k] = cor;
      });
    }
    for (const d of c?.dicas ?? []) if (d.tipo === 'letra') melhor[semAcento(d.valor)] = 'certo';
    return melhor;
  });

  ngOnChanges(mudou: SimpleChanges): void {
    const antes = mudou['conteudo']?.previousValue as ConteudoLegenda | undefined;
    // a palavra entrou: a linha vira e o campo esvazia
    if (antes && this.conteudo.linhas.length > antes.linhas.length) {
      this.atual.set('');
      this.aviso.set(null);
      this.virando.set(this.conteudo.linhas.length - 1);
    }
    if (mudou['conteudo']) this.dados.set(this.conteudo);
    if (mudou['recusa'] && this.recusa) {
      this.aviso.set(this.recusa);
      this.tremer();
    }
  }

  @HostListener('document:keydown', ['$event'])
  aoTeclar(evento: KeyboardEvent): void {
    if (this.fim || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const alvo = evento.target as HTMLElement | null;
    if (alvo?.closest('input, textarea, [contenteditable], [role="dialog"]')) return;
    const l = semAcento(evento.key);
    if (/^[a-z]$/.test(l)) {
      evento.preventDefault();
      this.tecla(l);
    } else if (evento.key === 'Backspace') {
      evento.preventDefault();
      this.apagar();
    } else if (evento.key === 'Enter' && !alvo?.closest('button, a')) {
      evento.preventDefault();
      this.enviar();
    }
  }

  tecla(l: string): void {
    if (this.fim || this.atual().length >= this.conteudo.tamanho) return;
    this.atual.update((a) => a + l);
  }

  apagar(): void {
    this.atual.update((a) => a.slice(0, -1));
  }

  enviar(): void {
    if (this.fim || this.ocupado) return;
    if (this.atual().length < this.conteudo.tamanho) {
      this.aviso.set({ texto: `A palavra tem ${this.conteudo.tamanho} letras`, vez: Date.now() });
      this.tremer();
      return;
    }
    this.palavra.emit(this.atual());
  }

  // sem foco na tecla da tela, o Enter do teclado físico não repete a última letra
  semFoco(evento: MouseEvent): void {
    evento.preventDefault();
  }

  private tremer(): void {
    this.tremendo.set(false);
    requestAnimationFrame(() => this.tremendo.set(true));
  }
}
