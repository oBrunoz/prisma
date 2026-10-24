import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-fundo-lirios',
  standalone: true,
  templateUrl: './fundo-lirios.component.html',
  styleUrls: ['./fundo-lirios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FundoLiriosComponent {}
