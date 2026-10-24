import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { Maratona } from '../../../../core/models/vitrine.models';
import { VitrineService } from '../../../../core/services/vitrine.service';
import { CarouselRowComponent } from '../../../../shared/components/carousel-row/carousel-row.component';

const NA_PILHA = 5;

@Component({
  selector: 'app-maratonas',
  standalone: true,
  imports: [RouterLink, CarouselRowComponent],
  templateUrl: './maratonas.component.html',
  styleUrls: ['./maratonas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaratonasComponent implements OnDestroy {
  private readonly vitrine = inject(VitrineService);
  private readonly destroy$ = new Subject<void>();

  readonly imagens = environment.tmdbImageUrl;
  readonly maratonas = signal<Maratona[] | null>(null);
  readonly esqueleto = Array(5).fill(0);

  // pequena e guardada na API: vem logo na abertura
  constructor() {
    this.vitrine
      .maratonas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (m) => this.maratonas.set(m), error: () => this.maratonas.set([]) });
  }

  pilha(m: Maratona): { src: string; esquerda: number; giro: number }[] {
    const posters = m.posters.slice(0, NA_PILHA);
    const passo = 58 / Math.max(posters.length - 1, 1);
    return posters.map((p, i) => ({
      src: `${this.imagens}/w185${p}`,
      esquerda: 6 + i * passo,
      giro: (i - (posters.length - 1) / 2) * 2,
    }));
  }

  horas(minutos: number): string {
    return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
