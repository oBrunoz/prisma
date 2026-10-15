export interface Mensagem {
  subject: string;
  text: string;
  html: string;
}

const ESPECTRO = [
  '#45417C',
  '#2880A8',
  '#78C4C4',
  '#F0E0C5',
  '#ECA352',
  '#D85057',
  '#942548',
];

function escapar(texto: string): string {
  return texto.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

// tabela e estilo em linha: e o que os clientes de e-mail entendem
function moldura(titulo: string, corpo: string): string {
  const fios = ESPECTRO.map(
    (cor) =>
      `<td style="height:4px;background:${cor};font-size:0;line-height:0">&nbsp;</td>`,
  ).join('');

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:32px 16px;background:#111111;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#F3EAD6;border-radius:8px;overflow:hidden">
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${fios}</tr></table></td></tr>
<tr><td style="padding:28px 28px 32px;color:#1a1a1a;font-size:15px;line-height:1.55">
<p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#45417C">Prisma</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#111111">${titulo}</h1>
${corpo}
</td></tr></table></body></html>`;
}

const nota = (texto: string) =>
  `<p style="margin:0;color:#4b4b4b;font-size:13px">${texto}</p>`;

export function codigoDeTroca(codigo: string, validadeMin: number): Mensagem {
  const espacado = `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
  const ressalva = `Vale por ${validadeMin} minutos. Se não foi você, ignore esta mensagem: nada muda na conta de ninguém.`;
  return {
    subject: `${espacado} é o seu código do Prisma`,
    text: `Seu código para confirmar este e-mail no Prisma: ${espacado}\n\n${ressalva}`,
    html: moldura(
      'Confirme seu e-mail',
      `<p style="margin:0 0 16px">Digite este código no Prisma para usar este e-mail na sua conta:</p>
<p style="margin:0 0 16px;font-size:30px;font-weight:bold;letter-spacing:.2em;color:#111111">${espacado}</p>
${nota(ressalva)}`,
    ),
  };
}

export function emailTrocado(novoMascarado: string): Mensagem {
  const ressalva =
    'Se não foi você, alguém pode estar usando sua senha. Entre no Prisma e troque a senha agora.';
  return {
    subject: 'O e-mail da sua conta no Prisma mudou',
    text: `O e-mail da sua conta no Prisma foi trocado. Agora você entra com ${novoMascarado}.\n\n${ressalva}`,
    html: moldura(
      'O e-mail da sua conta mudou',
      `<p style="margin:0 0 16px">Agora você entra no Prisma com <b>${escapar(novoMascarado)}</b>. Este endereço não recebe mais os avisos da conta.</p>
${nota(ressalva)}`,
    ),
  };
}

export function senhaTrocada(): Mensagem {
  const ressalva = 'Se não foi você, entre no Prisma e troque a senha de novo.';
  return {
    subject: 'A senha da sua conta no Prisma mudou',
    text: `A senha da sua conta no Prisma foi trocada, e as outras sessões foram encerradas.\n\n${ressalva}`,
    html: moldura(
      'Sua senha mudou',
      `<p style="margin:0 0 16px">A senha da sua conta foi trocada, e as outras sessões foram encerradas.</p>
${nota(ressalva)}`,
    ),
  };
}

// o aviso vai para o endereco antigo, que pode nao ser mais da pessoa
export function mascararEmail(email: string): string {
  const [local, dominio] = email.split('@');
  return `${local.slice(0, 1)}•••@${dominio}`;
}
