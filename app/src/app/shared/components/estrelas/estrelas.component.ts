import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// a nota é de 1 a 10: cada ponto é meia estrela
@Component({
  selector: 'app-estrelas',
  standalone: true,
  templateUrl: './estrelas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstrelasComponent {
  readonly nota = input.required<number>();

  readonly cheias = computed(() => '★'.repeat(Math.floor(this.nota() / 2)));
  readonly meia = computed(() => this.nota() % 2 === 1);
  readonly vazias = computed(() => '★'.repeat(5 - Math.ceil(this.nota() / 2)));
}
