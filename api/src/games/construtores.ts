import { TENTATIVAS } from './games.constants.js';
import type {
  DadosAssinatura,
  DadosCarreira,
  DadosDuelo,
  DadosFicha,
  DadosLegenda,
  DadosLetreiro,
  DadosLinha,
  DadosPersonagens,
  FilmeComNota,
  FilmeDoJogo,
  PessoaDoJogo,
  Pista,
} from './games.regras.js';
import { semAcento } from './games.regras.js';

// monta o conteúdo de cada jogo a partir da TMDB; quem chama decide de onde vem o buscar
export type Buscar = <T>(
  caminho: string,
  params?: Record<string, unknown>,
) => Promise<T>;

export class DesafioImpossivel extends Error {}

interface DetalhesTmdb {
  id: number;
  title: string;
  release_date?: string;
  runtime?: number | null;
  tagline?: string | null;
  poster_path: string | null;
  genres: { name: string }[];
  production_countries: { iso_3166_1: string }[];
  production_companies: { name: string }[];
  original_language: string;
  vote_average: number;
  vote_count: number;
}
interface CreditosTmdb {
  cast: { name: string; character: string; order: number }[];
  crew: { name: string; job: string }[];
}
interface FilmeDaListaTmdb {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
}
interface PessoaTmdb {
  id: number;
  name: string;
  profile_path: string | null;
}
interface CreditosDaPessoaTmdb {
  crew: (FilmeDaListaTmdb & { job: string })[];
}

const DOCUMENTARIO = 99;
const regiao = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
const idioma = new Intl.DisplayNames(['pt-BR'], { type: 'language' });

const ano = (data?: string) => (data ? Number(data.slice(0, 4)) : 0);
const paraFilme = (f: FilmeDaListaTmdb): FilmeDoJogo => ({
  tmdbId: f.id,
  title: f.title,
  year: ano(f.release_date),
  posterPath: f.poster_path,
});

// o mesmo dia sempre sorteia igual: reimportar não muda o desafio
export function sorteador(semente: string) {
  let h = 1779033703 ^ semente.length;
  for (let i = 0; i < semente.length; i++) {
    h = Math.imul(h ^ semente.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const proximo = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const embaralhar = <T>(lista: T[]) => {
    const c = [...lista];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(proximo() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  };
  return { proximo, embaralhar };
}

async function filmeCompleto(buscar: Buscar, tmdbId: number) {
  const [detalhes, creditos] = await Promise.all([
    buscar<DetalhesTmdb>(`/movie/${tmdbId}`),
    buscar<CreditosTmdb>(`/movie/${tmdbId}/credits`),
  ]);
  return { detalhes, creditos };
}

const direcao = (c: CreditosTmdb) =>
  c.crew
    .filter((p) => p.job === 'Director')
    .map((p) => p.name)
    .join(' e ');

// a tagline não pode trazer palavra do título (com 4 letras ou mais), senão entrega a resposta
function taglineSegura(d: DetalhesTmdb): string | null {
  if (!d.tagline) return null;
  const tag = semAcento(d.tagline).toLowerCase();
  const palavras = semAcento(d.title)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4);
  return palavras.some((p) => tag.includes(p)) ? null : d.tagline;
}

// as três pistas que a dica do letreiro e da legenda entrega, da mais vaga à mais forte
function pistasDeDica(d: DetalhesTmdb, c: CreditosTmdb): Pista[] {
  return [
    {
      rotulo: 'Ano e gênero',
      valor: [
        ano(d.release_date),
        ...d.genres.slice(0, 2).map((g) => g.name),
      ].join(' · '),
    },
    { rotulo: 'Direção', valor: direcao(c) || 'Sem crédito de direção' },
    {
      rotulo: 'Elenco',
      valor: c.cast
        .slice(0, 2)
        .map((p) => p.name)
        .join(' · '),
    },
  ];
}

/* ---------- Ficha ---------- */

export async function montarFicha(
  buscar: Buscar,
  tmdbId: number,
  curadoria: { pistas?: Pista[]; palavrasChave?: string[] } = {},
): Promise<DadosFicha> {
  if (curadoria.pistas) {
    if (curadoria.pistas.length !== TENTATIVAS)
      throw new DesafioImpossivel(`A ficha tem ${TENTATIVAS} pistas`);
    return { pistas: curadoria.pistas };
  }
  const { detalhes: d, creditos: c } = await filmeCompleto(buscar, tmdbId);
  const horas = d.runtime
    ? `${Math.floor(d.runtime / 60)}h ${String(d.runtime % 60).padStart(2, '0')}min`
    : null;
  const paises = d.production_countries
    .map((p) => regiao.of(p.iso_3166_1) ?? p.iso_3166_1)
    .slice(0, 2);
  // a quarta pista: palavras-chave traduzidas na curadoria, a tagline ou quem produziu
  const quarta: Pista = curadoria.palavrasChave?.length
    ? { rotulo: 'Palavras-chave', valor: curadoria.palavrasChave.join(' · ') }
    : taglineSegura(d)
      ? { rotulo: 'Tagline', valor: `“${taglineSegura(d)}”` }
      : {
          rotulo: 'Produção',
          valor:
            d.production_companies
              .slice(0, 2)
              .map((p) => p.name)
              .join(' · ') || 'Independente',
        };
  const elenco = c.cast.filter((p) => p.name);
  if (elenco.length < 3)
    throw new DesafioImpossivel(
      `Filme ${tmdbId}: elenco curto demais para a ficha`,
    );
  return {
    pistas: [
      {
        rotulo: 'Ano e duração',
        valor: [ano(d.release_date), horas].filter(Boolean).join(' · '),
      },
      { rotulo: 'Gêneros', valor: d.genres.map((g) => g.name).join(' · ') },
      {
        rotulo: 'País e idioma',
        valor: [
          ...paises,
          idioma.of(d.original_language) ?? d.original_language,
        ].join(' · '),
      },
      quarta,
      { rotulo: 'Direção', valor: direcao(c) || 'Sem crédito de direção' },
      {
        rotulo: 'Elenco de apoio',
        valor: elenco
          .slice(1, 4)
          .map((p) => p.name)
          .join(' · '),
      },
      { rotulo: 'Protagonista', valor: elenco[0].name },
    ],
  };
}

/* ---------- Personagens ---------- */

// personagem que não ajuda: figurante numerado ou descrito pela função, a própria pessoa, sem nome
const PERSONAGEM_VAZIO =
  /(#|\d|\bself\b|himself|herself|uncredited|additional|voices?\b|citizen|officer|reporter|anchor|guard|police|waiter|waitress|dealer|driver|soldier|pilot|nurse|thief|worker|girlfriend|boyfriend|scientist|trapper|student|agent \d|glader|double|patient|enthusiast|lover|dignitary|narrator|secretary|creature|computer|inspector|bishop|'s (father|mother)|young |little |\b(man|woman|boy|girl|kid|guy|lady)$|^$)/i;

export async function montarPersonagens(
  buscar: Buscar,
  tmdbId: number,
  curadoria?: [string, string, string][],
): Promise<DadosPersonagens> {
  if (curadoria) {
    if (curadoria.length !== TENTATIVAS)
      throw new DesafioImpossivel(`São ${TENTATIVAS} personagens`);
    return {
      personagens: curadoria.map(([posicao, nome, ator]) => ({
        posicao,
        nome,
        ator,
      })),
    };
  }
  const c = await buscar<CreditosTmdb>(`/movie/${tmdbId}/credits`);
  // personagem repetido no elenco é grupo (os soldados, os moradores), não alguém
  const vezes: Record<string, number> = {};
  for (const p of c.cast) vezes[p.character] = (vezes[p.character] ?? 0) + 1;
  const validos = c.cast
    .map((p, i) => ({
      ...p,
      i,
      // "Dennis / Patricia / Hedwig / …" fica com os dois primeiros nomes
      character: p.character
        .replace(/\s*\(voice\)$/i, '')
        .split(' / ')
        .slice(0, 2)
        .join(' / ')
        .trim(),
      repetido: vezes[p.character] > 1,
    }))
    .filter(
      (p) => p.i < 18 && !p.repetido && !PERSONAGEM_VAZIO.test(p.character),
    );
  if (validos.length < TENTATIVAS || validos[0].i !== 0) {
    throw new DesafioImpossivel(
      `Filme ${tmdbId}: poucos personagens com nome nos créditos`,
    );
  }
  // o protagonista por último; os outros espalhados do fim da lista para o começo
  const resto = validos.slice(1);
  const escolhidos = Array.from(
    { length: TENTATIVAS - 1 },
    (_, k) =>
      resto[
        Math.round(
          ((resto.length - 1) * (TENTATIVAS - 2 - k)) / (TENTATIVAS - 2),
        )
      ],
  );
  const unicos = [
    ...new Map([...escolhidos, validos[0]].map((p) => [p.i, p])).values(),
  ];
  if (unicos.length < TENTATIVAS)
    throw new DesafioImpossivel(`Filme ${tmdbId}: personagens repetidos`);
  return {
    personagens: unicos.map((p) => ({
      posicao: `${p.i + 1}º nos créditos`,
      nome: p.character,
      ator: p.name,
    })),
  };
}

/* ---------- Letreiro ---------- */

const VOGAIS = new Set(['A', 'E', 'I', 'O', 'U']);

// acendem primeiro as consoantes raras; vogais e letras repetidas ficam para o fim
export function ordemDoLetreiro(titulo: string): {
  ordem: string[];
  abertas: number[];
} {
  const conta: Record<string, number> = {};
  for (const c of semAcento(titulo).toUpperCase())
    if (/[A-Z0-9]/.test(c)) conta[c] = (conta[c] ?? 0) + 1;
  const ordem = Object.keys(conta).sort(
    (a, b) =>
      Number(VOGAIS.has(a)) - Number(VOGAIS.has(b)) ||
      conta[a] - conta[b] ||
      a.localeCompare(b),
  );
  // depois do sexto erro ainda sobra um quinto das letras apagado
  const abertas = Array.from({ length: TENTATIVAS }, (_, n) =>
    n ? Math.ceil((ordem.length * n) / 7.5) : 0,
  );
  return { ordem, abertas };
}

export async function montarLetreiro(
  buscar: Buscar,
  tmdbId: number,
): Promise<DadosLetreiro> {
  const { detalhes: d, creditos: c } = await filmeCompleto(buscar, tmdbId);
  const titulo = d.title.toUpperCase();
  const { ordem, abertas } = ordemDoLetreiro(titulo);
  if (ordem.length < 5)
    throw new DesafioImpossivel(
      `Filme ${tmdbId}: título curto demais para o letreiro`,
    );
  return { titulo, ordem, abertas, pistas: pistasDeDica(d, c) };
}

/* ---------- Legenda ---------- */

export async function montarLegenda(
  buscar: Buscar,
  tmdbId: number,
): Promise<DadosLegenda> {
  const { detalhes: d, creditos: c } = await filmeCompleto(buscar, tmdbId);
  const exibe = [...d.title.normalize('NFC').toUpperCase()];
  const palavra = semAcento(d.title).toLowerCase();
  if (!/^[a-z]{5,8}$/.test(palavra) || exibe.length !== palavra.length) {
    throw new DesafioImpossivel(
      `Filme ${tmdbId}: a Legenda pede título de uma palavra com 5 a 8 letras (${d.title})`,
    );
  }
  return { palavra, exibe, pistas: pistasDeDica(d, c) };
}

/* ---------- Assinatura e Carreira ---------- */

async function filmesDirigidos(
  buscar: Buscar,
  pessoaId: number,
  minimoDeVotos: number,
) {
  const [pessoa, creditos] = await Promise.all([
    buscar<PessoaTmdb>(`/person/${pessoaId}`),
    buscar<CreditosDaPessoaTmdb>(`/person/${pessoaId}/movie_credits`),
  ]);
  const vistos = new Set<number>();
  const candidatos = creditos.crew.filter((f) => {
    if (f.job !== 'Director' || !f.release_date || f.vote_count < minimoDeVotos)
      return false;
    if (f.genre_ids?.includes(DOCUMENTARIO) || vistos.has(f.id)) return false;
    vistos.add(f.id);
    return true;
  });
  // só longa-metragem; a TMDB às vezes tem o mesmo filme duas vezes (fica o mais votado)
  const detalhes = await Promise.all(
    candidatos.map((f) =>
      buscar<DetalhesTmdb & { original_title: string }>(`/movie/${f.id}`),
    ),
  );
  const porOriginal = new Map<string, FilmeDaListaTmdb>();
  candidatos.forEach((f, i) => {
    const d = detalhes[i];
    if ((d.runtime ?? 0) < 60) return;
    const chave = `${semAcento(d.original_title).toLowerCase()}|${ano(f.release_date)}`;
    const atual = porOriginal.get(chave);
    if (!atual || atual.vote_count < f.vote_count) porOriginal.set(chave, f);
  });
  // títulos iguais em português confundem na tela: fica o mais votado
  const porTitulo = new Map<string, FilmeDaListaTmdb>();
  for (const f of porOriginal.values()) {
    const chave = semAcento(f.title).toLowerCase();
    const atual = porTitulo.get(chave);
    if (!atual || atual.vote_count < f.vote_count) porTitulo.set(chave, f);
  }
  const quem: PessoaDoJogo = {
    tmdbId: pessoa.id,
    name: pessoa.name,
    profilePath: pessoa.profile_path,
  };
  return { pessoa: quem, filmes: [...porTitulo.values()] };
}

// sete filmes do menos ao mais conhecido, espalhados pela carreira; o mais famoso sempre por último
export async function montarAssinatura(
  buscar: Buscar,
  pessoaId: number,
): Promise<DadosAssinatura> {
  // com menos votos que isso entram curtas e vídeos que ninguém viu
  const { pessoa, filmes } = await filmesDirigidos(buscar, pessoaId, 100);
  if (filmes.length < TENTATIVAS)
    throw new DesafioImpossivel(
      `${pessoa.name}: menos de ${TENTATIVAS} filmes dirigidos`,
    );
  const porFama = [...filmes].sort((a, b) => a.vote_count - b.vote_count);
  const escolhidos = Array.from(
    { length: TENTATIVAS },
    (_, i) =>
      porFama[Math.round((i * (porFama.length - 1)) / (TENTATIVAS - 1))],
  );
  return { pessoa, filmes: escolhidos.map(paraFilme) };
}

// os sete mais votados, um por ano, na ordem de lançamento; a ordem inicial é embaralhada pelo dia
export async function montarCarreira(
  buscar: Buscar,
  pessoaId: number,
  dia: string,
): Promise<DadosCarreira> {
  const { pessoa, filmes } = await filmesDirigidos(buscar, pessoaId, 300);
  const porAno = new Map<number, FilmeDaListaTmdb>();
  for (const f of [...filmes].sort((a, b) => b.vote_count - a.vote_count)) {
    if (!porAno.has(ano(f.release_date))) porAno.set(ano(f.release_date), f);
  }
  const escolhidos = [...porAno.values()].slice(0, TENTATIVAS);
  if (escolhidos.length < TENTATIVAS)
    throw new DesafioImpossivel(
      `${pessoa.name}: menos de ${TENTATIVAS} filmes em anos diferentes`,
    );
  const certos = escolhidos.map(paraFilme).sort((a, b) => a.year - b.year);
  const ids = certos.map((f) => f.tmdbId);

  // no máximo um filme já no lugar, para a primeira conferida não sair de graça
  const { embaralhar } = sorteador(`carreira-${dia}-${pessoaId}`);
  let inicial = embaralhar(ids);
  for (
    let t = 0;
    t < 50 && inicial.filter((id, i) => id === ids[i]).length > 1;
    t++
  )
    inicial = embaralhar(ids);
  return { pessoa, filmes: certos, inicial };
}

/* ---------- Duelo e Linha do tempo ---------- */

// os mais votados (conhecidos) e os mais bem avaliados (inclui o lado B), sem documentário
async function poolDeFilmes(
  buscar: Buscar,
  paginas: { caminho: string; params?: Record<string, unknown> }[],
) {
  const listas = await Promise.all(
    paginas.map((p) =>
      buscar<{ results: FilmeDaListaTmdb[] }>(p.caminho, p.params),
    ),
  );
  const porId = new Map<number, FilmeDaListaTmdb>();
  for (const f of listas.flatMap((l) => l.results)) {
    if (f.release_date && f.poster_path && !f.genre_ids?.includes(DOCUMENTARIO))
      porId.set(f.id, f);
  }
  return [...porId.values()];
}

const paginas = (
  caminho: string,
  n: number,
  params: Record<string, unknown> = {},
) =>
  Array.from({ length: n }, (_, i) => ({
    caminho,
    params: { ...params, page: i + 1 },
  }));

// do duelo folgado ao apertado; a nota vai arredondada em uma casa e não pode empatar na tela
const DIFERENCAS = [1.0, 0.7, 0.5, 0.35, 0.25, 0.15, 0.1];

export async function montarDuelo(
  buscar: Buscar,
  dia: string,
  pares?: [number, number][],
): Promise<DadosDuelo> {
  const comNota = (f: FilmeDaListaTmdb | DetalhesTmdb): FilmeComNota => ({
    ...paraFilme(f as FilmeDaListaTmdb),
    nota: Math.round(f.vote_average * 100) / 100,
  });
  const umaCasa = (n: number) => Math.round(n * 10) / 10;

  if (pares) {
    if (pares.length !== TENTATIVAS)
      throw new DesafioImpossivel(`São ${TENTATIVAS} duelos`);
    const duelos = await Promise.all(
      pares.map(async ([a, b]) => {
        const [fa, fb] = await Promise.all([
          buscar<DetalhesTmdb>(`/movie/${a}`),
          buscar<DetalhesTmdb>(`/movie/${b}`),
        ]);
        const par: [FilmeComNota, FilmeComNota] = [comNota(fa), comNota(fb)];
        if (umaCasa(par[0].nota) === umaCasa(par[1].nota)) {
          throw new DesafioImpossivel(
            `Duelo ${fa.title} × ${fb.title}: notas iguais na tela`,
          );
        }
        return par;
      }),
    );
    return { duelos };
  }

  // os conhecidos e o lado B bem votado; filme com menos de um ano ainda tem nota mexendo
  const umAnoAntes = `${Number(dia.slice(0, 4)) - 1}${dia.slice(4)}`;
  const pool = await poolDeFilmes(buscar, [
    ...paginas('/discover/movie', 8, { sort_by: 'vote_count.desc' }),
    ...paginas('/discover/movie', 10, {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 1500,
    }),
  ]);
  const candidatos = pool.filter(
    (f) => f.vote_count >= 1000 && (f.release_date ?? '') <= umAnoAntes,
  );
  const { embaralhar } = sorteador(`duelo-${dia}`);
  const usados = new Set<number>();
  const duelos: [FilmeComNota, FilmeComNota][] = [];
  for (const alvo of DIFERENCAS) {
    const ordem = embaralhar(candidatos);
    let par: [FilmeDaListaTmdb, FilmeDaListaTmdb] | null = null;
    for (const a of ordem) {
      if (usados.has(a.id)) continue;
      const b = ordem.find((x) => {
        if (x.id === a.id || usados.has(x.id)) return false;
        const dif = Math.abs(x.vote_average - a.vote_average);
        return (
          dif >= alvo - 0.05 &&
          dif <= alvo + 0.1 &&
          umaCasa(x.vote_average) !== umaCasa(a.vote_average)
        );
      });
      if (b) {
        par = [a, b];
        break;
      }
    }
    if (!par)
      throw new DesafioImpossivel(
        `Duelo de ${dia}: sem par com diferença de ${alvo}`,
      );
    par.forEach((f) => usados.add(f.id));
    duelos.push([comNota(par[0]), comNota(par[1])]);
  }
  return { duelos };
}

export async function montarLinha(
  buscar: Buscar,
  dia: string,
  curadoria?: { ancora: number; filmes: number[] },
): Promise<DadosLinha> {
  if (curadoria) {
    if (curadoria.filmes.length !== TENTATIVAS)
      throw new DesafioImpossivel(
        `A linha tem ${TENTATIVAS} filmes além da âncora`,
      );
    const todos = await Promise.all(
      [curadoria.ancora, ...curadoria.filmes].map((id) =>
        buscar<DetalhesTmdb>(`/movie/${id}`),
      ),
    );
    const anos = new Set(todos.map((f) => ano(f.release_date)));
    if (anos.size !== todos.length)
      throw new DesafioImpossivel(`Linha de ${dia}: dois filmes no mesmo ano`);
    const [ancora, ...cartas] = todos.map((f) =>
      paraFilme(f as unknown as FilmeDaListaTmdb),
    );
    return { ancora, cartas };
  }

  const pool = await poolDeFilmes(
    buscar,
    paginas('/discover/movie', 10, { sort_by: 'vote_count.desc' }),
  );
  const { embaralhar } = sorteador(`linha-${dia}`);
  const porAno = new Map<number, FilmeDaListaTmdb>();
  for (const f of embaralhar(pool)) {
    if (!porAno.has(ano(f.release_date))) porAno.set(ano(f.release_date), f);
    if (porAno.size === TENTATIVAS + 1) break;
  }
  if (porAno.size < TENTATIVAS + 1)
    throw new DesafioImpossivel(`Linha de ${dia}: poucos anos diferentes`);
  // a âncora é a do meio, para haver vaga dos dois lados
  const oito = [...porAno.values()].map(paraFilme);
  const meio = [...oito].sort((a, b) => a.year - b.year)[
    Math.floor(oito.length / 2)
  ];
  return { ancora: meio, cartas: oito.filter((f) => f.tmdbId !== meio.tmdbId) };
}
