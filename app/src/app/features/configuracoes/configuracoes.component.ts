import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-configuracoes',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './configuracoes.component.html',
})
export class ConfiguracoesComponent {
  readonly secoes = [
    { caminho: 'perfil', rotulo: 'Perfil' },
    { caminho: 'conta', rotulo: 'Conta' },
  ];
}
