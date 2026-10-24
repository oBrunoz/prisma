import { ChangeDetectionStrategy, Component, ElementRef, HostListener, effect, inject, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideBookmark, LucideCheck, LucideEye, LucideHeart, LucideStar, LucideX } from '@lucide/angular';
import { FolhaAcoesService } from '../../../core/services/folha-acoes.service';
import { ACOES_RAPIDAS, MarcasService } from '../../../core/services/marcas.service';
import { PlataformasService } from '../../../core/services/plataformas.service';
import { PlataformasComponent } from '../plataformas/plataformas.component';

@Component({
  selector: 'app-folha-acoes',
  standalone: true,
  imports: [DecimalPipe, RouterModule, PlataformasComponent, LucideBookmark, LucideCheck, LucideEye, LucideHeart, LucideStar, LucideX],
  templateUrl: './folha-acoes.component.html',
  styleUrls: ['./folha-acoes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolhaAcoesComponent {
  readonly folha = inject(FolhaAcoesService);
  readonly marcas = inject(MarcasService);
  readonly acoes = ACOES_RAPIDAS;
  // no toque não há hover: a folha é onde a plataforma aparece (o card já pediu ao nascer)
  readonly plataformas = inject(PlataformasService);

  private readonly fecharBtn = viewChild<ElementRef<HTMLButtonElement>>('fecharBtn');
  private origem: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const botao = this.fecharBtn();
      if (botao) {
        this.origem = document.activeElement as HTMLElement | null;
        botao.nativeElement.focus();
      } else {
        this.origem?.focus();
        this.origem = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  aoEsc(): void {
    this.folha.fechar();
  }

  rota(tipo: 'movie' | 'tv', tmdbId: number): string[] {
    return ['/search', tipo === 'movie' ? 'movies' : 'series', String(tmdbId)];
  }
}
