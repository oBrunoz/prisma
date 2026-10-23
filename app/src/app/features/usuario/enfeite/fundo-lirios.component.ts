import { ChangeDetectionStrategy, Component } from '@angular/core';

// lírios de aquarela emoldurando o conteúdo do perfil: ramos presos aos cantos e às
// laterais, cada um com o próprio tamanho por tela, para o meio ficar livre para os cards
@Component({
  selector: 'app-fundo-lirios',
  standalone: true,
  templateUrl: './fundo-lirios.component.html',
  styleUrls: ['./fundo-lirios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FundoLiriosComponent {}
