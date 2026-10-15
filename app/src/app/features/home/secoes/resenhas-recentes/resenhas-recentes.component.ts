import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AvaliacaoUsuario } from '../../../../core/models/catalogo.models';
import { AvaliacaoService } from '../../../../core/services/avaliacao.service';
import { CartaoAvaliacaoComponent } from '../../../../shared/components/cartao-avaliacao/cartao-avaliacao.component';
import { CarouselRowComponent } from '../../../../shared/components/carousel-row/carousel-row.component';

// as resenhas mais novas da comunidade; sem nenhuma, a seção não aparece
@Component({
  selector: 'app-resenhas-recentes',
  standalone: true,
  imports: [CartaoAvaliacaoComponent, CarouselRowComponent],
  templateUrl: './resenhas-recentes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResenhasRecentesComponent implements OnDestroy {
  private readonly avaliacoes = inject(AvaliacaoService);
  private readonly destroy$ = new Subject<void>();

  readonly resenhas = signal<AvaliacaoUsuario[]>([]);

  // pequena e decide se a seção existe: vem logo na abertura, para não aparecer de repente na rolagem
  constructor() {
    this.avaliacoes
      .recentes(8)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r) => this.resenhas.set(r), error: () => this.resenhas.set([]) });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
