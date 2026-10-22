import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CONTATO_EMAIL, CONTROLADOR, SecaoLegal } from '../legal.config';
import { PaginaLegalComponent } from '../pagina-legal/pagina-legal.component';

@Component({
  selector: 'app-privacidade',
  standalone: true,
  imports: [RouterModule, PaginaLegalComponent],
  templateUrl: './privacidade.component.html',
})
export class PrivacidadeComponent {
  readonly email = CONTATO_EMAIL;
  readonly controlador = CONTROLADOR;

  readonly secoes: SecaoLegal[] = [
    { id: 'quem-somos', titulo: 'Quem somos' },
    { id: 'dados', titulo: 'Quais dados coletamos' },
    { id: 'finalidades', titulo: 'Para que usamos' },
    { id: 'publico', titulo: 'O que fica público' },
    { id: 'compartilhamento', titulo: 'Com quem compartilhamos' },
    { id: 'cookies', titulo: 'Cookies e armazenamento local' },
    { id: 'retencao', titulo: 'Por quanto tempo guardamos' },
    { id: 'seguranca', titulo: 'Como protegemos' },
    { id: 'direitos', titulo: 'Seus direitos' },
    { id: 'menores', titulo: 'Crianças e adolescentes' },
    { id: 'alteracoes', titulo: 'Mudanças nesta política' },
    { id: 'contato', titulo: 'Contato' },
  ];
}
