import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideStar, LucideExternalLink } from '@lucide/angular';
import { Review } from '../../../core/models/tmdb.models';
import { environment } from '../../../../environments/environment';

const LIMITE_PREVIA = 420;

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule, LucideStar, LucideExternalLink],
  templateUrl: './review-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCardComponent {
  @Input({ required: true }) review!: Review;

  isExpanded = signal(false);

  toggle(): void {
    this.isExpanded.update((v) => !v);
  }

  get avatarUrl(): string {
    const path = this.review.author_details?.avatar_path;
    if (!path) return '';
    // alguns avatares vêm como "/https://..." (Gravatar): o path já é a URL
    if (path.startsWith('/http')) return path.slice(1);
    return `${environment.tmdbImageUrl}/w185${path}`;
  }

  get initial(): string {
    return (this.review.author || '?').charAt(0).toUpperCase();
  }

  get rating(): number | null {
    return this.review.author_details?.rating ?? null;
  }

  // a TMDB manda markdown leve
  get content(): string {
    return (this.review.content || '')
      .replace(/<\/?[^>]+>/g, '')
      .replace(/\*\*|__|_/g, '')
      .trim();
  }

  get isLong(): boolean {
    return this.content.length > LIMITE_PREVIA;
  }

  get visibleContent(): string {
    if (!this.isLong || this.isExpanded()) return this.content;
    return this.content.slice(0, LIMITE_PREVIA).trimEnd() + '…';
  }
}
