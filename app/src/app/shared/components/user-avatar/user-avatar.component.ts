import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

type Tamanho = 'sm' | 'md' | 'lg';

const MEDIDAS: Record<Tamanho, { caixa: string; texto: string }> = {
  sm: { caixa: 'w-9 h-9', texto: 'text-xs' },
  md: { caixa: 'w-12 h-12', texto: 'text-base' },
  lg: { caixa: 'w-24 h-24', texto: 'text-3xl' },
};

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAvatarComponent {
  @Input() nome = '';
  @Input() avatarUrl: string | null = null;
  @Input() tamanho: Tamanho = 'md';

  get src(): string | null {
    if (!this.avatarUrl) return null;
    return this.avatarUrl.startsWith('/') ? `${environment.apiUrl}${this.avatarUrl}` : this.avatarUrl;
  }

  get medidas() {
    return MEDIDAS[this.tamanho];
  }

  get inicial(): string {
    return (this.nome.trim() || '?').charAt(0).toUpperCase();
  }
}
