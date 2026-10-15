import { ChangeDetectionStrategy, Component, ElementRef, HostListener, effect, inject, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideBookmark, LucideCheck, LucideEye, LucideHeart, LucideStar, LucideX } from '@lucide/angular';
import { FolhaAcoesService } from '../../../core/services/folha-acoes.service';
import { ACOES_RAPIDAS, MarcasService } from '../../../core/services/marcas.service';

@Component({
  selector: 'app-folha-acoes',
  standalone: true,
  imports: [DecimalPipe, RouterModule, LucideBookmark, LucideCheck, LucideEye, LucideHeart, LucideStar, LucideX],
  templateUrl: './folha-acoes.component.html',
  styleUrls: ['./folha-acoes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolhaAcoesComponent {
  readonly folha = inject(FolhaAcoesService);
  readonly marcas = inject(MarcasService);
  readonly acoes = ACOES_RAPIDAS;

  private readonly fecharBtn = viewChild<ElementRef<HTMLButtonElement>>('fecharBtn');
  // o foco volta para o ⋯ (ou o card) que abriu a folha
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
