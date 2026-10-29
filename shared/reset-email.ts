/**
 * The password-reset email.
 *
 * Built here as pure functions rather than sent from a template engine, so the
 * exact bytes that go out can be asserted in a test without an SMTP server.
 *
 * Why the app sends this itself instead of letting Supabase:
 *
 * Supabase Auth will only deliver to addresses belonging to the project team
 * unless the project has custom SMTP configured, and configuring that requires
 * a sending domain with SPF and DKIM records. This project has no such domain,
 * which left password reset working for exactly one person — the team owner —
 * and failing silently for the other 89 staff.
 *
 * Sending through Nodemailer sidesteps that entirely. Gmail authenticates
 * outgoing mail with its own DKIM signature, so the message is delivered on
 * exactly the same footing as any other mail sent from that account. The
 * tradeoff is that the From address is a Gmail one rather than a school domain,
 * which is why the copy is explicit about who the message is from.
 */

export const RESET_SUBJECT = "Reset your Global Kids School password";

/** Royal Indigo brand color kept in sync with client/src/index.css. */
const BRAND = "#4f46e5";

/**
 * Escape a value for interpolation into HTML.
 *
 * The recipient's name comes from a profile row an admin typed. Without this, a
 * display name containing markup would render as markup in a link that people
 * are being trained to click.
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

/**
 * Only http(s) links are ever put in the href.
 *
 * A `javascript:` URL here would be a stored-XSS vector aimed at exactly the
 * people least likely to be suspicious — someone who has just asked to reset
 * their password and expects to be sent to a link.
 */
export function safeResetUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

export interface ResetEmailInput {
  resetUrl: string;
  recipientName?: string;
  /**
   * Whose account the link opens, when the message went to somebody other than
   * the account holder — a pupil's family, whose address is the one on the
   * pupil's record. A family with more than one child needs to know which
   * account this is for.
   */
  onBehalfOf?: string;
}

/** The HTML body. Mail clients that block images still show the button. */
export function resetEmailHtml({
  resetUrl,
  recipientName,
  onBehalfOf,
}: ResetEmailInput): string {
  const url = safeResetUrl(resetUrl);
  const name = escapeHtml(recipientName).trim();
  const behalf = escapeHtml(onBehalfOf).trim();
  const greeting = name ? `Hello ${name},` : "Hello,";
  const whose = behalf
    ? `We received a request to reset the password for <strong style="color:#d7dee4;font-weight:600;">${behalf}</strong>. Choose a new one using the button below.`
    : "We received a request to reset the password for this account. Choose a new one using the button below.";
  // The URL is escaped for attribute and text use separately: the href needs
  // quotes escaped, the visible fallback needs the same treatment.
  const href = escapeHtml(url);

  if (!url) {
    return `<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;background:#0b0c10;color:#e7ebef;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#121419;border:1px solid #232830;border-radius:16px;padding:28px">
<h1 style="margin:0 0 12px;font-size:20px">Password reset unavailable</h1>
<p style="color:#9aa6af;font-size:14px;line-height:1.6">We could not build a valid reset link for this account. Please ask an administrator to reset your password for you.</p>
</div></body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>${RESET_SUBJECT}</title>
</head>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">A link to choose a new password. It expires shortly.</div>
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
              Reset your password
            </h1>
            <p style="margin:0 0 16px;color:#9aa6af;font-size:14px;line-height:1.6;">
              ${greeting}<br />
              ${whose}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;">
              <tr>
                <td align="center" style="background:${BRAND};border-radius:10px;">
                  <a href="${href}"
                    style="display:inline-block;padding:13px 28px;color:#06231d;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">
                    Choose a new password
                  </a>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background:#151a20;border:1px solid #232830;border-radius:10px;margin:0 0 20px;">
              <tr>
                <td style="padding:14px 16px;color:#8b96a0;font-size:12.5px;line-height:1.6;">
                  <strong style="color:#d7dee4;font-weight:600;">This link expires shortly and works only once.</strong>
                  If it has expired, ask an administrator, or request another from the sign-in page.
                </td>
              </tr>
            </table>
            <p style="margin:0 0 22px;color:#6b7480;font-size:12.5px;line-height:1.6;">
              If the button does not work, copy this link into your browser:<br />
              <a href="${href}" style="color:${BRAND};word-break:break-all;text-decoration:underline;">${href}</a>
            </p>
            <p style="margin:0;padding-top:18px;border-top:1px solid #1e232b;color:#6b7480;font-size:12.5px;line-height:1.6;">
              If you did not request this, ignore this email — your password will not change
              until someone opens the link above and sets a new one.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 34px 28px;text-align:center;">
            <div style="color:#4c545e;font-size:12px;line-height:1.6;">
              Global Kids School · Tumakuru<br />
              <span style="color:#3a4149;">Sent by the school administrator on behalf of Global Kids School ERP.</span>
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
export function resetEmailText({
  resetUrl,
  onBehalfOf,
}: ResetEmailInput): string {
  const url = safeResetUrl(resetUrl);
  const behalf = String(onBehalfOf ?? "").trim();
  const whose = behalf
    ? `We received a request to reset the password for ${behalf}.`
    : "We received a request to reset the password for this account.";
  return `Reset your password — Global Kids School

${whose}
Choose a new one using the link below:

${url || "(this link could not be generated — please ask an administrator)"}

This link expires shortly and works only once.

If you did not request this, you can safely ignore this email. Your
password will not change until someone opens the link above.

Global Kids School · Tumakuru
Sent by the school administrator on behalf of Global Kids School ERP.
`;
}
