import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

let transporter: Transporter | null | undefined;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!smtpConfigured()) {
    transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || '',
          }
        : undefined,
  });
  return transporter;
}

export function isEmailEnabled(): boolean {
  return smtpConfigured();
}

export function appOrigin(): string {
  return String(process.env.APP_ORIGIN || 'http://localhost:5200').replace(/\/$/, '');
}

/**
 * Send email via SMTP when configured; otherwise log to console (dev-safe fallback).
 * Never throws — callers should not fail business operations on mail errors.
 */
export async function sendMail(input: SendMailInput): Promise<{ sent: boolean; mode: 'smtp' | 'log' }> {
  const toList = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  if (toList.length === 0) {
    return { sent: false, mode: 'log' };
  }

  const from = process.env.SMTP_FROM || 'noreply@localhost';
  const transport = getTransporter();

  if (!transport) {
    console.info(
      `[email:log] to=${toList.join(',')} subject=${JSON.stringify(input.subject)}\n${input.text}`,
    );
    return { sent: true, mode: 'log' };
  }

  try {
    await transport.sendMail({
      from,
      to: toList.join(', '),
      subject: input.subject,
      text: input.text,
      html: input.html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(input.text)}</pre>`,
    });
    return { sent: true, mode: 'smtp' };
  } catch (error) {
    console.error('[email] Failed to send:', error);
    console.info(
      `[email:fallback-log] to=${toList.join(',')} subject=${JSON.stringify(input.subject)}\n${input.text}`,
    );
    return { sent: false, mode: 'log' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
