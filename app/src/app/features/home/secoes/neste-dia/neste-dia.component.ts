import { DecimalPipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideStar } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { NesteDia } from '../../../../core/models/vitrine.models';
import { VitrineService } from '../../../../core/services/vitrine.service';
import { AparecerDirective } from '../../../../shared/directives/aparecer.directive';

// o filme que faz aniversário de estreia hoje, e mais quatro do mesmo dia em outros anos
@Component({
  selector: 'app-neste-dia',
  standalone: true,
  imports: [DecimalPipe, RouterLink, LucideArrowRight, LucideStar, AparecerDirective],
  templateUrl: './neste-dia.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NesteDiaComponent implements OnDestroy {
  private readonly vitrine = inject(VitrineService);
  private readonly destroy$ = new Subject<void>();

  readonly imagens = environment.tmdbImageUrl;
  readonly dados = signal<NesteDia | null>(null);

  // o dia vem da API (Brasília), não do relógio do aparelho
  readonly dataPorExtenso = computed(() => {
    const dia = this.dados()?.day;
    return dia ? formatDate(`${dia}T12:00:00`, "d 'de' MMMM", 'pt-BR') : '';
  });

  carregar(): void {
    this.vitrine
      .nesteDia()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (d) => this.dados.set(d), error: () => this.dados.set(null) });
  }

  ano(data: string): string {
    return data.slice(0, 4);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
