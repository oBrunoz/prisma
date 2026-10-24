import { DecimalPipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideStar } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { NesteDia } from '../../../../core/models/vitrine.models';
import { VitrineService } from '../../../../core/services/vitrine.service';

@Component({
  selector: 'app-neste-dia',
  standalone: true,
  imports: [DecimalPipe, RouterLink, LucideArrowRight, LucideStar],
  templateUrl: './neste-dia.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NesteDiaComponent implements OnDestroy {
  private readonly vitrine = inject(VitrineService);
  private readonly destroy$ = new Subject<void>();

  readonly imagens = environment.tmdbImageUrl;
  readonly dados = signal<NesteDia | null>(null);
  readonly carregado = signal(false);
  readonly esqueleto = Array(4).fill(0);

  // o dia vem da API (Brasília), não do relógio do aparelho
  readonly dataPorExtenso = computed(() => {
    const dia = this.dados()?.day;
    return dia ? formatDate(`${dia}T12:00:00`, "d 'de' MMMM", 'pt-BR') : '';
  });

  // pequeno e guardado na API: vem logo na abertura
  constructor() {
    this.vitrine
      .nesteDia()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (d) => {
          this.dados.set(d);
          this.carregado.set(true);
        },
        error: () => this.carregado.set(true),
      });
  }

  ano(data: string): string {
    return data.slice(0, 4);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
