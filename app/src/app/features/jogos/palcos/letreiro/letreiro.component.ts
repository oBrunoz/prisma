import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
import { ConteudoLetreiro } from '../../../../core/models/jogos.models';
import { ESPECTRO } from '../../../../core/models/espectro';

interface Casa {
  i: number;
  c: string;
  letra: boolean;
  cor: string;
}

const LETRA = /[\p{L}\p{N}]/u;
const CREME = '#F3EAD6';

@Component({
  selector: 'app-letreiro',
  standalone: true,
  templateUrl: './letreiro.component.html',
  styleUrls: ['./letreiro.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LetreiroComponent implements OnChanges {
  @Input({ required: true }) conteudo!: ConteudoLetreiro;

  private readonly dados = signal<ConteudoLetreiro | null>(null);
  readonly acendendo = signal<Set<number>>(new Set());

  readonly palavras = computed(() => {
    const letras = this.dados()?.letras ?? [];
    const palavras: Casa[][] = [[]];
    letras.forEach(({ c, nivel }, i) => {
      if (c === ' ') {
        palavras.push([]);
        return;
      }
      const letra = c === '' || LETRA.test(c);
      const cor = nivel === null ? 'transparent' : nivel < ESPECTRO.length ? ESPECTRO[nivel] : CREME;
      palavras[palavras.length - 1].push({ i, c, letra, cor });
    });
    return palavras.filter((p) => p.length);
  });

  readonly resumo = computed(() => {
    const p = this.palavras();
    const letras = p.flat().filter((c) => c.letra).length;
    return `${p.length} ${p.length === 1 ? 'palavra' : 'palavras'}, ${letras} letras`;
  });

  readonly maior = computed(() => Math.max(1, ...this.palavras().map((p) => p.length)));

  ngOnChanges(mudou: SimpleChanges): void {
    const antes = mudou['conteudo']?.previousValue as ConteudoLetreiro | undefined;
    if (antes) {
      const novas = new Set<number>();
      this.conteudo.letras.forEach((l, i) => l.c && !antes.letras[i]?.c && novas.add(i));
      this.acendendo.set(novas);
    }
    this.dados.set(this.conteudo);
  }
}
