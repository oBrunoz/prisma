import { HttpErrorResponse } from '@angular/common/http';

const SEM_CONEXAO = 'Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.';
const MUITAS_TENTATIVAS = 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
const INDISPONIVEL = 'O serviço está indisponível no momento. Tente novamente em instantes.';
const GENERICA = 'Algo não saiu como esperado. Tente novamente em instantes.';

// o usuário não tem o que fazer com status HTTP: a mensagem diz o que houve e o que ele pode fazer
export function mensagemDeErro(erro: unknown, porStatus: Record<number, string> = {}): string {
  const status = erro instanceof HttpErrorResponse ? erro.status : -1;

  if (porStatus[status]) return porStatus[status];
  if (status === 0) return SEM_CONEXAO;
  if (status === 429) return MUITAS_TENTATIVAS;
  if (status >= 500) return INDISPONIVEL;

  return GENERICA;
}

export function erroMenciona(erro: unknown, campo: string): boolean {
  const detalhe = erro instanceof HttpErrorResponse ? erro.error?.message : null;
  const itens = Array.isArray(detalhe) ? detalhe : detalhe ? [String(detalhe)] : [];

  return itens.some((item) => String(item).toLowerCase().includes(campo));
}

// não é o dado do usuário que está errado
export function ehFalhaDeSistema(erro: unknown): boolean {
  const status = erro instanceof HttpErrorResponse ? erro.status : -1;
  return status === 0 || status === 429 || status >= 500;
}

// o ValidationPipe começa cada mensagem pelo nome da propriedade ("username must be...")
export function camposRecusados(erro: unknown): Set<string> {
  const detalhe = erro instanceof HttpErrorResponse ? erro.error?.message : null;
  const itens = Array.isArray(detalhe) ? detalhe : detalhe ? [String(detalhe)] : [];

  return new Set(itens.map((item) => String(item).split(' ')[0]));
}
