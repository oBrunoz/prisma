import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { ESPECTRO } from '../../../../core/models/espectro';

export interface LinhaDePista {
  rotulo: string;
  // null enquanto está tapada
  valor: string | null;
  detalhe?: string | null;
}

// tarjas de larguras diferentes, para a linha fechada não entregar o tamanho do texto
const LARGURAS = ['38%', '64%', '72%', '44%', '86%', '58%', '40%'];

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
