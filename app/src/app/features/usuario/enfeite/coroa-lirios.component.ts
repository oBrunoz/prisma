import { ChangeDetectionStrategy, Component } from '@angular/core';

// meia coroa do buquê abraçando o avatar grande (w-24) pela esquerda e por cima
@Component({
  selector: 'app-coroa-lirios',
  standalone: true,
  templateUrl: './coroa-lirios.component.html',
  styleUrls: ['./coroa-lirios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoroaLiriosComponent {}
