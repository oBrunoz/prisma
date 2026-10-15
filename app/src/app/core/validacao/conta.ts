// mesmas regras do CreateUserDto da API; '' quer dizer válido
const FORMATO_USERNAME = /^[a-z0-9_]+$/;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarNome(valor: string): string {
  const nome = valor.trim();
  if (!nome) return 'Informe seu nome.';
  if (nome.length < 2) return 'Use pelo menos 2 letras.';
  return '';
}

export function validarUsername(valor: string): string {
  if (!valor) return 'Escolha um nome de usuário.';
  if (!FORMATO_USERNAME.test(valor)) return 'Use só letras minúsculas, números e _.';
  if (valor.length < 3) return 'Use pelo menos 3 caracteres.';
  return '';
}

export function validarEmail(valor: string): string {
  const email = valor.trim();
  if (!email) return 'Informe seu e-mail.';
  if (!FORMATO_EMAIL.test(email)) return 'Confira o e-mail, parece incompleto.';
  return '';
}

export function validarSenhaNova(valor: string): string {
  if (!valor) return 'Crie uma senha.';
  if (valor.length < 8) return 'Use pelo menos 8 caracteres.';
  return '';
}

// no login só importa ter digitado; regra de tamanho aqui daria pista a quem tenta adivinhar
export function validarSenhaDigitada(valor: string): string {
  return valor ? '' : 'Informe sua senha.';
}

// mesma regra da API: vazio tira a foto; fora isso, endereço http(s)
export function validarFoto(valor: string): string {
  const foto = valor.trim();
  if (!foto) return '';
  if (!/^https?:\/\/\S+\.\S+$/i.test(foto)) return 'Use um endereço que comece com http:// ou https://.';
  return '';
}
