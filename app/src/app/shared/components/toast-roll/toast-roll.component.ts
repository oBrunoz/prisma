import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideCheck, LucideHeart, LucideInfo, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { ESPECTRO } from '../../../core/models/espectro';
import { AcaoToast, COR_DO_TIPO, TipoToast, Toast, ZONA_DO_TIPO } from '../../../core/models/toast.models';
import { ToastService } from '../../../core/services/toast.service';

// igual à transição de grid-template-rows do .rolo-slot
const RECOLHER_MS = 300;

@Component({
  selector: 'app-toast-roll',
  standalone: true,
  imports: [LucideCheck, LucideHeart, LucideInfo, LucideTriangleAlert, LucideX],
  templateUrl: './toast-roll.component.html',
  styleUrls: ['./toast-roll.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastRollComponent {
  readonly toast = inject(ToastService);
  readonly espectro = ESPECTRO;
  readonly corDoTipo = COR_DO_TIPO;

  private readonly recolhendo = signal<ReadonlySet<number>>(new Set());

  aceso(tipo: TipoToast, indice: number): boolean {
    return ZONA_DO_TIPO[tipo].includes(indice);
  }

  estaRecolhendo(id: number): boolean {
    return this.recolhendo().has(id);
  }

  executar(t: Toast, acao: AcaoToast): void {
    acao.executar();
    this.toast.fechar(t.id);
  }

  // o Angular prefixa os keyframes do componente, daí o endsWith
  aoAnimar(evento: AnimationEvent, t: Toast): void {
    const nome = evento.animationName;

    if (nome.endsWith('rebobina')) {
      this.recolher(t.id);
    } else if (nome.endsWith('esvazia') && (evento.target as Element).matches(':last-child')) {
      this.toast.fechar(t.id);
    }
  }

  private recolher(id: number): void {
    this.recolhendo.update((ids) => new Set(ids).add(id));

    setTimeout(() => {
      this.toast.remover(id);
      this.recolhendo.update((ids) => {
        const resto = new Set(ids);
        resto.delete(id);
        return resto;
      });
    }, RECOLHER_MS);
  }
}
