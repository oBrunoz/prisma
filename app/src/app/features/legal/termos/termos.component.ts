import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CONTATO_EMAIL, CONTROLADOR, SecaoLegal } from '../legal.config';
import { PaginaLegalComponent } from '../pagina-legal/pagina-legal.component';

@Component({
  selector: 'app-termos',
  standalone: true,
  imports: [RouterModule, PaginaLegalComponent],
  templateUrl: './termos.component.html',
})
export class TermosComponent {
  readonly email = CONTATO_EMAIL;
  readonly controlador = CONTROLADOR;

  readonly secoes: SecaoLegal[] = [
    { id: 'aceitacao', titulo: 'Aceitação' },
    { id: 'conta', titulo: 'Sua conta' },
    { id: 'conteudo', titulo: 'O que você publica' },
    { id: 'conduta', titulo: 'Uso aceitável' },
    { id: 'jogos', titulo: 'Jogos diários' },
    { id: 'tmdb', titulo: 'Dados de filmes e séries' },
    { id: 'disponibilidade', titulo: 'Disponibilidade' },
    { id: 'encerramento', titulo: 'Suspensão e encerramento' },
    { id: 'alteracoes', titulo: 'Mudanças nestes termos' },
    { id: 'lei', titulo: 'Lei aplicável e foro' },
    { id: 'contato', titulo: 'Contato' },
  ];
}
