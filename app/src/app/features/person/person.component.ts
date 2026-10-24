import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { MovieService, srcsetDeFundo } from '../../core/services/movie.service';
import { MovieCardComponent } from '../../shared/components/movie-card/movie-card.component';
import { CarouselRowComponent } from '../../shared/components/carousel-row/carousel-row.component';
import { PersonCredit, PersonDetails } from '../../core/models/tmdb.models';
import { environment } from '../../../environments/environment';
import { SeoService } from '../../core/services/seo.service';
import { MediaFallbackComponent } from '../../shared/components/media-fallback/media-fallback.component';
import { DEPARTAMENTOS } from '../../core/busca/busca';

@Component({
  selector: 'app-person',
  standalone: true,
  imports: [CommonModule, MovieCardComponent, CarouselRowComponent, MediaFallbackComponent],
  templateUrl: './person.component.html',
  styleUrls: ['./person.component.css'],
})
export class PersonComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private movieService = inject(MovieService);
  private seo = inject(SeoService);

  person = signal<PersonDetails | null>(null);
  isLoading = signal(true);
  bioExpanded = signal(false);

  skeletonCards = Array(6).fill(0);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.params
      .pipe(
        switchMap((params) => {
          this.isLoading.set(true);
          this.person.set(null);
          this.bioExpanded.set(false);
          return this.movieService
            .getPersonDetails(Number(params['id']))
            .pipe(catchError(() => of(null)));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((person) => {
        this.person.set(person);
        this.isLoading.set(false);
        if (person) this.definirSeo(person);
      });
  }

  private definirSeo(person: PersonDetails): void {
    const foto = person.profile_path ? `${environment.tmdbImageUrl}/h632${person.profile_path}` : null;
    this.seo.definir({
      titulo: `${person.name}: filmes e séries`,
      descricao: person.biography || `Filmes e séries com ${person.name}: filmografia completa, papéis e onde assistir.`,
      imagem: foto,
      tipo: 'profile',
      dados: {
        '@type': 'Person',
        name: person.name,
        image: foto ?? undefined,
        birthDate: person.birthday ?? undefined,
        deathDate: person.deathday ?? undefined,
        birthPlace: person.place_of_birth ?? undefined,
        description: person.biography || undefined,
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  profileUrl = computed(() =>
    this.movieService.getImageUrl(this.person()?.profile_path ?? null, 'h632')
  );

  credits = computed<PersonCredit[]>(() => this.movieService.getPersonCredits(this.person()));

  readonly srcsetDeFundo = srcsetDeFundo;

  knownFor = computed(() => this.credits().slice(0, 20));

  backdropUrl = computed(() => {
    const comBackdrop = this.credits().find((c) => c.backdrop_path);
    return comBackdrop
      ? `${environment.tmdbImageUrl}/w1280${comBackdrop.backdrop_path}`
      : '';
  });

  role = computed(() => {
    const dept = this.person()?.known_for_department;
    return dept ? DEPARTAMENTOS[dept] ?? dept : '';
  });

  age = computed<number | null>(() => {
    const birthday = this.person()?.birthday;
    if (!birthday) return null;

    const fim = this.person()?.deathday ? new Date(this.person()!.deathday!) : new Date();
    const nascimento = new Date(birthday);

    let anos = fim.getFullYear() - nascimento.getFullYear();
    const meses = fim.getMonth() - nascimento.getMonth();
    if (meses < 0 || (meses === 0 && fim.getDate() < nascimento.getDate())) anos--;

    return anos;
  });

  titleCount = computed(() => this.credits().length);

  careerSpan = computed<string>(() => {
    const anos = this.credits()
      .map((c) => c.release_date || c.first_air_date)
      .filter((data): data is string => !!data)
      .map((data) => new Date(data).getFullYear())
      .filter((ano) => !Number.isNaN(ano));

    if (!anos.length) return '';
    const inicio = Math.min(...anos);
    const fim = Math.max(...anos);
    return inicio === fim ? String(inicio) : `${inicio} – ${fim}`;
  });

  averageRating = computed<number | null>(() => {
    const notas = this.credits()
      .filter((c) => (c.vote_count ?? 0) > 0 && c.vote_average > 0)
      .map((c) => c.vote_average);

    if (!notas.length) return null;
    return notas.reduce((soma, nota) => soma + nota, 0) / notas.length;
  });

  toggleBio(): void {
    this.bioExpanded.update((v) => !v);
  }

  creditTitle(credit: PersonCredit): string {
    return credit.title ?? credit.name ?? '';
  }

  creditYear(credit: PersonCredit): string {
    const data = credit.release_date || credit.first_air_date;
    return data ? String(new Date(data).getFullYear()) : '';
  }

  creditMediaType(credit: PersonCredit): 'movies' | 'series' {
    return credit.media_type === 'tv' ? 'series' : 'movies';
  }

  creditRole(credit: PersonCredit): string {
    return credit.character || credit.job || '';
  }
}
