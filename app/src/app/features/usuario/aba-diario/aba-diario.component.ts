import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideHeart, LucideTextAlignStart } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { AvaliacaoUsuario, Midia } from '../../../core/models/catalogo.models';
import { AvaliacaoService } from '../../../core/services/avaliacao.service';
import { MovieService } from '../../../core/services/movie.service';
import { EstrelasComponent } from '../../../shared/components/estrelas/estrelas.component';
import { MediaFallbackComponent } from '../../../shared/components/media-fallback/media-fallback.component';

const POR_PAGINA = 30;

const MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

interface Mes {
  rotulo: string;
  itens: AvaliacaoUsuario[];
}

@Component({
  selector: 'app-aba-diario',
  standalone: true,
  imports: [RouterModule, EstrelasComponent, MediaFallbackComponent, LucideHeart, LucideTextAlignStart],
  templateUrl: './aba-diario.component.html',
})
export class AbaDiarioComponent implements OnInit, OnDestroy {
  private readonly avaliacaoService = inject(AvaliacaoService);
  private readonly movieService = inject(MovieService);

  readonly userId = input.required<string>();
  readonly username = input.required<string>();

  readonly itens = signal<AvaliacaoUsuario[]>([]);
  readonly pagina = signal(0);
  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly fim = signal(false);

  readonly meses = computed<Mes[]>(() => {
    const meses: Mes[] = [];
    for (const item of this.itens()) {
      const rotulo = item.watchedAt ? MES.format(new Date(item.watchedAt)) : '';
      const ultimo = meses.at(-1);
      if (ultimo?.rotulo === rotulo) ultimo.itens.push(item);
      else meses.push({ rotulo, itens: [item] });
    }
    return meses;
  });

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.carregar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  carregar(): void {
    if (this.carregando() || this.fim()) return;
    this.carregando.set(true);
    this.erro.set('');

    const proxima = this.pagina() + 1;
    this.avaliacaoService
      .porUsuario(this.userId(), POR_PAGINA, 'diario', proxima)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.itens.update((atuais) => [...atuais, ...lista]);
          this.pagina.set(proxima);
          this.fim.set(lista.length < POR_PAGINA);
          this.carregando.set(false);
        },
        error: (falha) => {
          this.erro.set(mensagemDeErro(falha));
          this.carregando.set(false);
        },
      });
  }

  dia(item: AvaliacaoUsuario): string {
    return item.watchedAt ? String(new Date(item.watchedAt).getDate()).padStart(2, '0') : '';
  }

  posterUrl(midia: Midia): string {
    return this.movieService.getImageUrl(midia.posterPath, 'w92');
  }

  tipoDeCard(midia: Midia): 'movies' | 'series' {
    return midia.type === 'MOVIE' ? 'movies' : 'series';
  }

  ano(midia: Midia): string {
    return midia.releaseDate ? midia.releaseDate.slice(0, 4) : '';
  }
}
