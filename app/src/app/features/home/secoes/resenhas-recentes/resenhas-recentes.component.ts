import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AvaliacaoUsuario } from '../../../../core/models/catalogo.models';
import { AvaliacaoService } from '../../../../core/services/avaliacao.service';
import { CartaoAvaliacaoComponent } from '../../../../shared/components/cartao-avaliacao/cartao-avaliacao.component';
import { CarouselRowComponent } from '../../../../shared/components/carousel-row/carousel-row.component';
import { AparecerDirective } from '../../../../shared/directives/aparecer.directive';

// as resenhas mais novas da comunidade; sem nenhuma, a seção não aparece
@Component({
  selector: 'app-resenhas-recentes',
  standalone: true,
  imports: [CartaoAvaliacaoComponent, CarouselRowComponent, AparecerDirective],
  templateUrl: './resenhas-recentes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResenhasRecentesComponent implements OnDestroy {
  private readonly avaliacoes = inject(AvaliacaoService);
  private readonly destroy$ = new Subject<void>();

  readonly resenhas = signal<AvaliacaoUsuario[]>([]);

  carregar(): void {
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
