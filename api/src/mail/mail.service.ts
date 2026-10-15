import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Mensagem } from './mail.templates.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporte: Transporter;
  private readonly remetente: string;

  constructor(config: ConfigService) {
    const porta = config.getOrThrow<number>('SMTP_PORT');
    const usuario = config.get<string>('SMTP_USER');

    this.transporte = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: porta,
      // 465 ja abre em TLS; nas outras o nodemailer sobe para TLS via STARTTLS
      secure: porta === 465,
      auth: usuario
        ? { user: usuario, pass: config.get<string>('SMTP_PASS') }
        : undefined,
    });
    this.remetente = config.getOrThrow<string>('MAIL_FROM');
  }

  async enviar(para: string, mensagem: Mensagem): Promise<void> {
    await this.transporte.sendMail({
      from: this.remetente,
      to: para,
      ...mensagem,
    });
  }

  // avisos que nao podem derrubar a operacao que ja aconteceu
  avisar(para: string, mensagem: Mensagem): void {
    this.enviar(para, mensagem).catch((erro: unknown) =>
      this.logger.error(`Aviso "${mensagem.subject}" nao enviado`, erro),
    );
  }
}
