/**
 * The sign-in code email.
 *
 * Built as pure functions rather than sent from a template engine, so the exact
 * bytes that go out can be asserted in a test without an SMTP server — the same
 * approach `shared/reset-email.ts` takes for the password reset message.
 *
 * ## Why the app sends this itself
 *
 * Supabase Auth will only deliver to addresses belonging to the project team
 * unless the project has custom SMTP configured, and configuring that requires
 * a sending domain with SPF and DKIM records. This project has no such domain,
 * so the school sends its own mail through Nodemailer. Gmail signs outgoing
 * mail with its own DKIM key, so the message is delivered on exactly the same
 * footing as any other mail sent from that account.
 *
 * ## Why a code rather than a link
 *
 * A code proves the person can read the mailbox without handing them a
 * session-bearing URL to click, and it expires in minutes. A link to a page
 * that then signs them in is a far larger thing to get wrong: it lives in the
 * browser history, in the mail client's logs and in any proxy in between.
 *
 * ## The code itself
 *
 * Six digits, generated with rejection sampling in
 * `shared/portal-accounts.ts` so the range is even. Only its hash is stored,
 * and the hash is salted with the id of the row holding it, so a leaked table
 * read yields nothing usable inside the code's remaining lifetime.
 */

/** Royal Indigo brand color kept in sync with client/src/index.css. */
const BRAND = "#4f46e5";

export const OTP_SUBJECT = "Your Global Kids School sign-in code";

/**
 * Escape a value for interpolation into HTML.
 *
 * The recipient's name comes from a record an admin typed. Without this, a
 * display name containing markup would render as markup in a message that
 * people are trained to read carefully and type a number out of.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] as string
  );
}

export interface OtpEmailInput {
  /** The six digits the person types back. */
  code: string;
  /** Who the account belongs to, when the school knows. */
  recipientName?: string;
  /**
   * Set when the code went to a guardian rather than to the account's own
   * address, so the message says whose account it opens.
   */
  onBehalfOf?: string;
  /** Minutes the code stays usable, for the copy. */
  validMinutes?: number;
}

/** The HTML body. Mail clients that block images still show the number. */
export function otpEmailHtml({
  code,
  recipientName,
  onBehalfOf,
  validMinutes = 10,
}: OtpEmailInput): string {
  const digits = String(code ?? "").replace(/\D/g, "").slice(0, 6);
  const name = escapeHtml(recipientName).trim();
  const behalf = escapeHtml(onBehalfOf).trim();
  const greeting = name ? `Hello ${name},` : "Hello,";
  const context = behalf
    ? `Use this code to sign in to the Global Kids School account for <strong style="color:#d7dee4;font-weight:600;">${behalf}</strong>.`
    : "Use this code to sign in to your Global Kids School account.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>${OTP_SUBJECT}</title>
</head>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your sign-in code. It expires shortly.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#0b0c10;margin:0;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:520px;background:#121419;border:1px solid #232830;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:30px 34px 22px;text-align:center;border-bottom:1px solid #1e232b;">
            <img src="{{ logo }}" width="56" height="56" alt="Global Kids School"
              style="display:block;box-sizing:border-box;margin:0 auto 14px;border:0;border-radius:50%;outline:none;text-decoration:none;" />
            <div style="color:#e7ebef;font-size:17px;font-weight:700;line-height:1.3;">Global Kids School</div>
            <div style="color:#6b7480;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;">
              School OS · Admin Portal
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 34px 8px;">
            <h1 style="margin:0 0 14px;color:#ffffff;font-size:21px;font-weight:700;line-height:1.3;letter-spacing:-0.015em;">
              Your sign-in code
            </h1>
            <p style="margin:0 0 16px;color:#9aa6af;font-size:14px;line-height:1.6;">
              ${greeting}<br />
              ${context}
            </p>
            <div style="margin:26px 0;padding:18px;text-align:center;background:#151a20;border:1px solid #232830;border-radius:12px;">
              <div style="color:${BRAND};font-size:34px;font-weight:700;letter-spacing:0.32em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">
                ${digits}
              </div>
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:#151a20;border:1px solid #232830;border-radius:10px;margin:0 0 20px;">
              <tr>
                <td style="padding:14px 16px;color:#8b96a0;font-size:12.5px;line-height:1.6;">
                  <strong style="color:#d7dee4;font-weight:600;">This code expires in ${validMinutes} minutes and can be used once.</strong>
                  If you did not ask to sign in, ignore this email — nobody can use the code without it.
                </td>
              </tr>
            </table>
            <p style="margin:0;padding-top:18px;border-top:1px solid #1e232b;color:#6b7480;font-size:12.5px;line-height:1.6;">
              Global Kids School · Tumakuru<br />
              <span style="color:#3a4149;">Sent by the school administrator on behalf of Global Kids School ERP.</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 34px 28px;text-align:center;">
            <div style="color:#4c545e;font-size:12px;line-height:1.6;">
              Never share this code. School staff will never ask you for it.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The plain-text body.
 *
 * Not optional decoration: a plain-text part is what keeps the message out of
 * the spam folder, and it is the only version that survives a client which
 * strips HTML entirely.
 */
export function otpEmailText({
  code,
  recipientName,
  onBehalfOf,
  validMinutes = 10,
}: OtpEmailInput): string {
  const digits = String(code ?? "").replace(/\D/g, "").slice(0, 6);
  const name = String(recipientName ?? "").trim();
  const behalf = String(onBehalfOf ?? "").trim();
  const context = behalf
    ? `Use this code to sign in to the Global Kids School account for ${behalf}.`
    : "Use this code to sign in to your Global Kids School account.";

  return `Your sign-in code — Global Kids School

${name ? `Hello ${name},` : "Hello,"}
${context}

${digits}

This code expires in ${validMinutes} minutes and can be used once.

If you did not ask to sign in, you can safely ignore this email. Nobody can
use the code without it.

Global Kids School · Tumakuru
Sent by the school administrator on behalf of Global Kids School ERP.
`;
}
