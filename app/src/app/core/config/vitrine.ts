// Curadoria das seções da home

// um por semana, em rodízio
export const DIRETORES_DA_SEMANA = [
  137427, // Denis Villeneuve
  8557, // Fernando Meirelles
  21684, // Bong Joon Ho
  45400, // Greta Gerwig
  1032, // Martin Scorsese
  1016214, // Kleber Mendonça Filho
  608, // Hayao Miyazaki
  525, // Christopher Nolan
  68813, // Céline Sciamma
  138, // Quentin Tarantino
  8574, // Walter Salles
  1769, // Sofia Coppola
  10828, // Guillermo del Toro
  291263, // Jordan Peele
  5655, // Wes Anderson
  6817, // Agnès Varda
];

// streamings com catálogo no Brasil, na ordem das pills; `em` é o "na Netflix" / "no Globoplay"
export const STREAMINGS = [
  { id: 8, nome: 'Netflix', em: 'Na' },
  { id: 119, nome: 'Prime Video', em: 'No' },
  { id: 1899, nome: 'Max', em: 'Na' },
  { id: 337, nome: 'Disney+', em: 'No' },
  { id: 350, nome: 'Apple TV+', em: 'Na' },
  { id: 307, nome: 'Globoplay', em: 'No' },
];

// as sete décadas casam com as sete cores do espectro, na mesma ordem
export const DECADAS = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

export const decadaParams = (inicio: number): Record<string, string> => ({
  'primary_release_date.gte': `${inicio}-01-01`,
  'primary_release_date.lte': `${inicio + 9}-12-31`,
});

// "quanto tempo você tem": a duração vira filtro de discover
export const FAIXAS_DE_DURACAO: { id: string; rotulo: string; params: Record<string, number> }[] = [
  { id: 'curto', rotulo: 'Até 1h35', params: { 'with_runtime.gte': 60, 'with_runtime.lte': 95 } },
  { id: 'medio', rotulo: 'Umas 2 horas', params: { 'with_runtime.gte': 96, 'with_runtime.lte': 130 } },
  { id: 'longo', rotulo: 'A noite toda', params: { 'with_runtime.gte': 150 } },
];
