import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { DIRETORES_DA_SEMANA } from '../../../../core/config/vitrine';
import { PersonCredit, PersonDetails } from '../../../../core/models/tmdb.models';
import { MovieService } from '../../../../core/services/movie.service';
import { CarouselRowComponent } from '../../../../shared/components/carousel-row/carousel-row.component';
import { MovieCardComponent } from '../../../../shared/components/movie-card/movie-card.component';
import { AparecerDirective } from '../../../../shared/directives/aparecer.directive';

const SEMANA = 7 * 24 * 60 * 60 * 1000;
// abaixo disso de votos costuma ser curta ou trabalho de estudante
const MIN_VOTOS = 50;

// um diretor por semana, com os longas em linha do tempo
@Component({
  selector: 'app-cadeira-do-diretor',
  standalone: true,
  imports: [DecimalPipe, RouterLink, LucideArrowRight, CarouselRowComponent, MovieCardComponent, AparecerDirective],
  templateUrl: './cadeira-do-diretor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadeiraDoDiretorComponent implements OnDestroy {
  private readonly movies = inject(MovieService);
  private readonly destroy$ = new Subject<void>();

  readonly pessoa = signal<PersonDetails | null>(null);

  // longas dirigidos, sem repetir e em ordem de lançamento
  readonly filmes = computed(() => {
    const vistos = new Set<number>();
    return (this.pessoa()?.combined_credits?.crew ?? [])
      .filter((c) => c.job === 'Director' && c.media_type === 'movie' && c.release_date && c.poster_path && c.vote_count >= MIN_VOTOS)
      .filter((c) => !vistos.has(c.id) && !!vistos.add(c.id))
      .sort((a, b) => a.release_date!.localeCompare(b.release_date!));
  });

  readonly mediaDasNotas = computed(() => {
    const f = this.filmes();
    return f.length ? f.reduce((s, c) => s + c.vote_average, 0) / f.length : 0;
  });

  // o fundo é o filme mais visto dele
  readonly fundo = computed(() => {
    const maisVisto = [...this.filmes()].sort((a, b) => b.vote_count - a.vote_count)[0];
    return maisVisto?.backdrop_path ? this.movies.getImageUrl(maisVisto.backdrop_path, 'w1280') : '';
  });

  readonly foto = computed(() => this.movies.getImageUrl(this.pessoa()?.profile_path ?? null, 'h632'));

  readonly origem = computed(() => {
    const p = this.pessoa();
    if (!p) return '';
    const ano = p.birthday?.slice(0, 4);
    const lugar = p.place_of_birth?.split(',').slice(0, 2).join(',').trim();
    if (ano && lugar) return `Nasceu em ${ano}, em ${lugar}.`;
    if (ano) return `Nasceu em ${ano}.`;
    return '';
  });

  carregar(): void {
    const id = DIRETORES_DA_SEMANA[Math.floor(Date.now() / SEMANA) % DIRETORES_DA_SEMANA.length];
    this.movies
      .getPersonDetails(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (p) => this.pessoa.set(p), error: () => this.pessoa.set(null) });
  }

  ano(filme: PersonCredit): string {
    return filme.release_date?.slice(0, 4) ?? '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
