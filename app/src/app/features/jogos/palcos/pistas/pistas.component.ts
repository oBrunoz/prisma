import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { ESPECTRO } from '../../../../core/models/espectro';

export interface LinhaDePista {
  rotulo: string;
  // null enquanto está tapada
  valor: string | null;
  // embaixo do valor, menor (quem fez o personagem, no fim)
  detalhe?: string | null;
}

// tarjas de larguras diferentes, para a linha fechada não entregar o tamanho do texto
const LARGURAS = ['38%', '64%', '72%', '44%', '86%', '58%', '40%'];

// a ficha: sete linhas com o fio de cada tentativa; a linha que abre destapa da esquerda para a direita
@Component({
  selector: 'app-pistas',
  standalone: true,
  templateUrl: './pistas.component.html',
  styleUrls: ['./pistas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PistasComponent implements OnChanges {
  @Input({ required: true }) titulo!: string;
  @Input() legenda = '';
  @Input({ required: true }) linhas: LinhaDePista[] = [];
  // personagens: o valor é um nome, em destaque
  @Input() destaque = false;

  readonly espectro = ESPECTRO;
  readonly larguras = LARGURAS;
  readonly abrindo = signal<Set<number>>(new Set());

  ngOnChanges(mudou: SimpleChanges): void {
    const antes = (mudou['linhas']?.previousValue as LinhaDePista[] | undefined) ?? null;
    if (!antes) return;
    const novas = new Set<number>();
    this.linhas.forEach((l, i) => l.valor !== null && antes[i]?.valor == null && novas.add(i));
    this.abrindo.set(novas);
  }
}
