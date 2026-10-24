import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { ConteudoAssinatura } from '../../../../core/models/jogos.models';
import { ESPECTRO } from '../../../../core/models/espectro';

const LARGURAS = ['66%', '80%', '48%', '30%', '76%', '60%', '38%'];

@Component({
  selector: 'app-filmografia',
  standalone: true,
  templateUrl: './filmografia.component.html',
  styleUrls: ['./filmografia.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilmografiaComponent implements OnChanges {
  @Input({ required: true }) conteudo!: ConteudoAssinatura;

  readonly espectro = ESPECTRO;
  readonly larguras = LARGURAS;
  readonly imagens = environment.tmdbImageUrl;
  readonly abrindo = signal<Set<number>>(new Set());

  ngOnChanges(mudou: SimpleChanges): void {
    const antes = mudou['conteudo']?.previousValue as ConteudoAssinatura | undefined;
    if (!antes) return;
    const novas = new Set<number>();
    this.conteudo.filmes.forEach((f, i) => f.title !== null && antes.filmes[i]?.title == null && novas.add(i));
    this.abrindo.set(novas);
  }
}
