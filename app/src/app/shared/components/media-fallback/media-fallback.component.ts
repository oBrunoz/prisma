import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideClapperboard, LucideImage, LucideUser } from '@lucide/angular';

export type FallbackKind = 'poster' | 'person' | 'logo';

@Component({
  selector: 'app-media-fallback',
  standalone: true,
  imports: [CommonModule, LucideClapperboard, LucideUser, LucideImage],
  templateUrl: './media-fallback.component.html',
})
export class MediaFallbackComponent {
  @Input() kind: FallbackKind = 'poster';

  @Input() label = '';

  @Input() compact = false;
}
