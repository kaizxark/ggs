/**
 * Delivery of the sign-in code.
 *
 * Kept out of the routes so both the password challenge and the code-only
 * sign-in send exactly the same message. This module uses Nodemailer and must
 * only be imported by Node-runtime functions.
 */

import nodemailer from "nodemailer";
import {
  OTP_SUBJECT,
  otpEmailHtml,
  otpEmailText,
} from "./otp-email.js";
import { OTP_TTL_SECONDS } from "./portal-accounts.js";

/** How long the mail relay is given before the attempt is abandoned. */
export const SMTP_TIMEOUT_MS = 8_000;

export interface OtpMailInput {
  to: string;
  code: string;
  recipientName?: string;
  onBehalfOf?: string;
  logoUrl: string;
}

/** Deliver a code. Returns false rather than throwing on failure. */
export async function sendOtpEmail(input: OtpMailInput): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    // Gmail refuses plain auth on anything but an implicit-TLS port.
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: input.to,
    subject: OTP_SUBJECT,
    text: otpEmailText({
      code: input.code,
      recipientName: input.recipientName,
      onBehalfOf: input.onBehalfOf,
      validMinutes: Math.round(OTP_TTL_SECONDS / 60),
    }),
    html: otpEmailHtml({
      code: input.code,
      recipientName: input.recipientName,
      onBehalfOf: input.onBehalfOf,
      validMinutes: Math.round(OTP_TTL_SECONDS / 60),
    }).replace("{{ logo }}", input.logoUrl),
  });
  return true;
}
