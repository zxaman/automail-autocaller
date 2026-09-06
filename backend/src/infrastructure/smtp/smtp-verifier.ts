import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../../config/environment';
import { classifySmtpError, type SmtpFailure } from './smtp-error';

export interface SmtpCredentials {
  email: string;
  appPassword: string;
}

export interface SmtpVerificationResult {
  success: boolean;
  failure?: SmtpFailure;
}

export interface TestEmailInput extends SmtpCredentials {
  fromName: string;
  to: string;
}

export interface OutboundAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendMessageInput extends SmtpCredentials {
  fromName: string;
  to: string;
  toName: string | null;
  subject: string;
  html: string;
  text: string;
  attachments: OutboundAttachment[];
}

export interface SendMessageResult {
  success: boolean;
  /** SMTP acceptance only. This is not an open, a read, or a delivery receipt. */
  providerMessageId?: string;
  failure?: SmtpFailure;
}

/**
 * Owns every outbound SMTP connection.
 *
 * Transports are built per operation and closed immediately, so a decrypted
 * App Password lives only for the duration of one call and is never cached on
 * a long-lived object.
 */
export class SmtpVerifier {
  /** Proves the credential works before it is ever stored. */
  public async verify(credentials: SmtpCredentials): Promise<SmtpVerificationResult> {
    const transporter = this.createTransport(credentials);

    try {
      await transporter.verify();
      return { success: true };
    } catch (error) {
      return { success: false, failure: classifySmtpError(error) };
    } finally {
      transporter.close();
    }
  }

  public async sendTestEmail(input: TestEmailInput): Promise<SmtpVerificationResult> {
    const transporter = this.createTransport(input);

    try {
      await transporter.sendMail({
        from: { name: input.fromName, address: input.email },
        to: input.to,
        subject: 'Your Gmail account is connected',
        text:
          'This is a test message from AutoCall & AutoMail.\n\n' +
          'If you are reading it, your Gmail account is connected and able to send email.',
        html:
          '<p>This is a test message from <strong>AutoCall &amp; AutoMail</strong>.</p>' +
          '<p>If you are reading it, your Gmail account is connected and able to send email.</p>',
      });

      return { success: true };
    } catch (error) {
      return { success: false, failure: classifySmtpError(error) };
    } finally {
      transporter.close();
    }
  }

  /**
   * Sends one message to one recipient.
   *
   * There is deliberately no bulk path: every recipient gets an individual
   * message, so nobody can see who else was contacted.
   */
  public async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const transporter = this.createTransport(input);

    try {
      const info = await transporter.sendMail({
        from: { name: input.fromName, address: input.email },
        to: input.toName ? { name: input.toName, address: input.to } : input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments,
      });

      return { success: true, providerMessageId: info.messageId };
    } catch (error) {
      return { success: false, failure: classifySmtpError(error) };
    } finally {
      transporter.close();
    }
  }

  private createTransport(credentials: SmtpCredentials): Transporter {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: credentials.email, pass: credentials.appPassword },
      connectionTimeout: env.SMTP_TIMEOUT_MS,
      greetingTimeout: env.SMTP_TIMEOUT_MS,
      socketTimeout: env.SMTP_TIMEOUT_MS,
      // Nodemailer's logger would print the auth exchange; both stay off so a
      // credential can never reach the log stream.
      logger: false,
      debug: false,
    });
  }
}
