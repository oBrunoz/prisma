import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OutraPagina, SecaoLegal } from '../legal.config';
import { PaginaLegalComponent } from '../pagina-legal/pagina-legal.component';

@Component({
  selector: 'app-sobre',
  standalone: true,
  imports: [RouterModule, PaginaLegalComponent],
  templateUrl: './sobre.component.html',
})
export class SobreComponent {
  readonly outras: OutraPagina[] = [
    { rota: '/termos', rotulo: 'Termos de uso' },
    { rota: '/privacidade', rotulo: 'Política de privacidade' },
  ];

  readonly secoes: SecaoLegal[] = [
    { id: 'o-que-e', titulo: 'O que é' },
    { id: 'nome', titulo: 'Por que Prisma' },
    { id: 'quem-faz', titulo: 'Quem faz' },
    { id: 'creditos', titulo: 'Créditos' },
  ];
}
