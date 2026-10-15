// convite para avaliar depois de um atalho: banner da home e cards usam os mesmos textos
export const CONVITES_ASSISTIDO = [
  'Assistiu? Então conta aí: valeu a pipoca?',
  'E aí, amou, odiou ou ficou no meio-termo? Deixa sua nota enquanto tá fresquinho.',
  'Mais um pra conta! Que tal dizer o que achou?',
];

export const CONVITES_CURTIDO = [
  'Curtiu, hein? Aproveita e deixa uma nota também.',
  'Gostou? Conta pro pessoal o que te pegou.',
];

export function sortear(opcoes: string[]): string {
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}
