import { Resend } from 'resend';
import { env } from './env';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Último correo enviado (solo para pruebas y desarrollo sin Resend). */
export const outbox: Mail[] = [];

/**
 * Envía con Resend si hay RESEND_API_KEY; si no, lo muestra en consola
 * (útil en desarrollo para copiar el enlace).
 */
export async function sendMail(mail: Mail): Promise<void> {
  const { RESEND_API_KEY, MAIL_FROM } = env();
  if (!RESEND_API_KEY) {
    outbox.push(mail);
    if (outbox.length > 50) outbox.shift();
    console.info(`[mail] Para: ${mail.to} | ${mail.subject}\n${mail.text}`);
    return;
  }
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: MAIL_FROM, ...mail });
  if (error) throw new Error(`No se pudo enviar el correo: ${error.message}`);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
