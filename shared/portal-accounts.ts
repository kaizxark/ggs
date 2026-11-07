/**
 * Portal sign-in: the rules both sides of the wire have to agree on.
 *
 * ## The shape of sign-in
 *
 * A person signs in by proving they own an email address. The app sends them a
 * one-time code; they type it back; only then are they asked to choose a
 * username and a password. After that they sign in the ordinary way, with the
 * username and password they chose, and can change either whenever they like.
 *
 * The ordering is the whole point. The old arrangement issued a password to
 * everyone the moment a record was saved — a date of birth, in practice — which
 * meant the credential was guessable by anyone who knew the person, and that a
 * leak of the credentials table handed over a child's date of birth. Here the
 * person holds the only secret that matters, and they choose it themselves.
 *
 * ## Why this module is browser-safe
 *
 * Everything in here is pure: no environment variables, no service key, no
 * fetch. Both `api/otp.ts` and the sign-in screen import it, so anything that
 * reads a secret would put that secret in the browser bundle. The database is
 * reached for from the routes, never from here.
 */

/** Six digits. Short enough to read off a phone, long enough given the limits below. */
export const OTP_LENGTH = 6;

/**
 * Marks a code that was issued only after a correct password.
 *
 * `login_otp_codes` is shared by the passwordless code sign-in and the
 * second-factor challenge. A student or member of staff must never be able to
 * use a code that was not preceded by their password, so those rows carry this
 * prefix and the verifier refuses a plain row for those roles.
 */
export const PASSWORD_OTP_PREFIX = "pwd:";

/** How long a code stays usable. */
export const OTP_TTL_SECONDS = 10 * 60;

/**
 * Wrong guesses allowed against one issued code.
 *
 * Low on purpose. A six-digit code has a million possibilities, so the only
 * thing standing between an attacker and a full sweep is this counter plus the
 * ten minute life. Ten attempts inside ten minutes is comfortable for a person
 * who has misread one digit twice and stops a sweep dead.
 */
export const OTP_MAX_ATTEMPTS = 10;

/**
 * Codes per address per fifteen minutes.
 *
 * Without this the route is a mail cannon pointed at somebody else's inbox:
 * anyone who knows a pupil's address could make the school send them hundreds
 * of messages a day, which is both harassment of the family and a fast way to
 * get the sending domain reputationally destroyed.
 */
export const OTP_SEND_COOLDOWN_SECONDS = 15 * 60;

/**
 * Reserved by RFC 2606 and guaranteed never to resolve.
 *
 * Placeholder addresses use it deliberately. A placeholder that resolved could
 * receive a real person's mail; one that resolves to a squatter's server could
 * be used to confirm which addresses exist. `.invalid` cannot be registered,
 * delegated or intercepted, so a placeholder is inert by construction rather
 * than by hoping nobody claimed it.
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "gks.invalid";

/**
 * Emails allow a couple of characters the username pattern excludes.
 *
 * Copied from `shared/username-lookup.ts` rather than imported: that module
 * reads the service key, and this one has to stay safe to bundle for the
 * browser. Kept identical on purpose — two different email patterns in one
 * system means an address accepted by one and rejected by the other.
 */
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** Trim and lowercase. Every comparison in the system goes through this first. */
export function normaliseEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Syntactically usable as a sign-in address. */
export function isUsableEmail(value: unknown): boolean {
  const email = normaliseEmail(value);
  return EMAIL_PATTERN.test(email) && email.length <= 254;
}

/** True for the addresses this module generates rather than a person supplying. */
export function isPlaceholderEmail(value: unknown): boolean {
  return normaliseEmail(value).endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/**
 * The school's own mail domains.
 *
 * A pupil's own address on their record is sometimes a mailbox at the school
 * rather than one the family reads: the older children here were given
 * addresses at the school domain when their records were created, and nobody
 * ever checks that mailbox. A sign-in code sent there is a code nobody sees,
 * and the pupil is told to wait for an email that is not coming.
 *
 * So an address at one of these domains is not treated as the pupil's own
 * mailbox. The family's address on the record is used instead, because that is
 * the one the school holds for the purpose of reaching them.
 *
 * It is a list rather than a rule because "is this address one a family reads"
 * is not something that can be worked out from the address itself. It lives
 * here, in one place, so that changing it is a one-line edit.
 */
export const SCHOOL_MAIL_DOMAINS = ["gks.edu.in", "globalskids.edu.in"];

/**
 * True when the address is at one of the school's own domains.
 *
 * The comparison is on the domain alone, so a teacher's mailbox is treated the
 * same way as the school's shared one: neither is the pupil's own.
 */
export function isSchoolDomainEmail(value: unknown): boolean {
  const email = normaliseEmail(value);
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1);
  return SCHOOL_MAIL_DOMAINS.includes(domain);
}

/**
 * The local part of an address, lowercased.
 *
 * Returns "" for anything that is not an address, so a caller can never end up
 * building a username out of a full address by accident.
 */
export function emailLocalPart(value: unknown): string {
  const email = normaliseEmail(value);
  if (!isUsableEmail(email)) return "";
  return email.slice(0, email.lastIndexOf("@"));
}

/**
 * The domain part of an address, lowercased. "" when there is no address.
 */
export function emailDomain(value: unknown): string {
  const email = normaliseEmail(value);
  if (!isUsableEmail(email)) return "";
  return email.slice(email.lastIndexOf("@") + 1);
}

/**
 * A placeholder address for a record that has no real one yet.
 *
 * `scope` is "student" or "staff" so a person reading a list of addresses can
 * tell what a row is without joining it back to its table, and `token` only
 * has to be unique within the school — the migration puts the uniqueness
 * constraint on (organisation, address), not on the address alone.
 */
export function placeholderEmail(scope: string, token: string): string {
  const safeScope = String(scope ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const safeToken = String(token ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${safeScope || "account"}-${safeToken || "pending"}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/**
 * A cryptographically random six-digit code.
 *
 * Rejection sampling rather than `value % 900000 + 100000`. A plain modulo over
 * a 32-bit draw is biased: 2^32 is not a multiple of 900000, so the low end of
 * the range comes up measurably more often, and the codes are guessable
 * precisely because guessing them is the attack. Rejecting the top of the range
 * until a whole number of draws fits costs a handful of retries and removes the
 * skew entirely.
 */
export function generateOtpCode(): string {
  const ceiling = Math.floor(0x100000000 / 10 ** OTP_LENGTH) * 10 ** OTP_LENGTH;
  const out = new Uint32Array(1);
  let draw: number;
  do {
    crypto.getRandomValues(out);
    draw = out[0];
  } while (draw >= ceiling);
  return String(draw % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0");
}

/**
 * Hash a code for storage.
 *
 * Only the hash is kept. A database read then yields nothing usable inside the
 * code's remaining ten minutes, and the salt means two identical codes do not
 * produce identical rows — so "do these two people share a code" is not a
 * question the table answers by inspection.
 *
 * The salt is the id of the row holding the code, which is unique and known to
 * the verifier, so verification does not need a second lookup.
 */
export async function hashOtp(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare a submitted code against a stored hash, in time independent of how
 * many leading characters happened to match.
 *
 * A plain `===` on two hex strings returns as soon as it finds a difference,
 * so the time it takes leaks how much of a guess was right. The attacker would
 * need microsecond-resolution timing over a network to use it, which is a much
 * harder bar than it looks, but there is no reason to leave the door unlocked
 * when the loop is four lines.
 */
export async function verifyOtpHash(
  code: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await hashOtp(code, salt);
  const a = actual.slice(0, 32);
  const b = normaliseEmail(expectedHash).slice(0, 32);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/**
 * Alphabet for generated secrets.
 *
 * No I, l, 1, O or 0. This secret is read off a screen by a member of staff and
 * typed into another machine, so the characters that get confused with one
 * another in a font — I from l from 1, O from 0 — are worth more than the extra
 * entropy they would add.
 */
const SECRET_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * A random secret, drawn from the platform CSPRNG.
 *
 * This is the password a freshly provisioned account carries until its owner
 * replaces it, and it is what `api/otp.ts` exchanges for a session once someone
 * has proved they own the mailbox. Both jobs make it a real credential, so it
 * is generated with `crypto.getRandomValues` rather than `Math.random` — the
 * latter is seeded from a 32-bit state in most engines and can be walked
 * backwards from a few outputs, which would turn "I proved I own the inbox"
 * into "I guessed the password".
 *
 * Rejection sampling again, for the same reason as `generateOtpCode`.
 */
export function generateSecret(length = 24): string {
  const size = Math.max(8, Math.min(128, Math.trunc(length)));
  const limit =
    Math.floor(0x100000000 / SECRET_ALPHABET.length) * SECRET_ALPHABET.length;
  const out = new Uint32Array(1);
  let chars = "";
  while (chars.length < size) {
    crypto.getRandomValues(out);
    if (out[0] >= limit) continue;
    chars += SECRET_ALPHABET[out[0] % SECRET_ALPHABET.length];
  }
  return chars;
}

/**
 * The password a record's owner starts with: their date of birth as six digits.
 *
 * A pupil born on 29 August 2005 signs in with `290805`.
 *
 * Day first, then month, then the last two digits of the year. DDMM is the
 * ordering used by Indian school records and Indian date fields, so it is the
 * one somebody reading their own admission slip will type without being told.
 *
 * ## Why this is weak, stated plainly
 *
 * A six-digit code has a million possibilities, and a date of birth is not a
 * secret — it is printed on a birth certificate, quoted in a WhatsApp group,
 * and known to every teacher who has marked a register. Any of those is enough
 * to sign in as that child.
 *
 * It is used here because the school asked for it, and because the flow around
 * it is built to make it temporary rather than permanent:
 *
 *   * the code is derived from the record, so it is never stored anywhere as a
 *     secret it might leak from;
 *   * every person can change it from Settings, and the route that does so needs
 *     no new table, so nothing here depends on a migration having run;
 *   * a school that later wants a real credential has OTP sign-in already built
 *     beside this one, which has no guessable password at any point.
 *
 * Anything with more than six digits of entropy has to be chosen by the owner,
 * which is why the change path matters more than the length of the initial one.
 */
export function ddmmDate(value: unknown): string | null {
  const raw = String(value ?? "").trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const [, year, month, day] = match;
  const mm = Number(month);
  const dd = Number(day);

  // Range checks alone would accept 31 February, so the date is rebuilt and
  // compared: a pupil must not be issued a password derived from a bad record,
  // because it would be a password nobody can work out from their own birth
  // date.
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const check = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(check.getTime())) return null;
  if (check.getUTCMonth() + 1 !== mm || check.getUTCDate() !== dd) return null;

  return `${String(dd).padStart(2, "0")}${String(mm).padStart(2, "0")}${year.slice(2)}`;
}

/**
 * Password rules, enforced the same way on both sides.
 *
 * Length first and deliberately: NIST and the UK's own guidance both treat a
 * long passphrase as stronger than a short string with punctuation forced
 * into it, and a ruleset that demands a symbol mostly produces `Password1!`.
 *
 * The floor is eight, which is the current minimum from both bodies of
 * guidance. The upper bound matters too — bcrypt truncates at 72 bytes, so a
 * longer input is silently ignored past that point and a rule that appears to
 * allow 200 characters is really allowing 72 plus noise.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export function passwordProblem(password: unknown): string | null {
  const value = String(password ?? "");
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[a-z]/i.test(value)) {
    return "Include at least one letter.";
  }
  if (!/\d/.test(value)) {
    return "Include at least one number.";
  }
  return null;
}

/** The shape both credential tables share, whichever record they hang off. */
export interface PortalCredential {
  username: string;
  password: string;
  email: string;
  must_set_password: boolean;
  issued_at: string;
  issued_by: string | null;
  revoked_at: string | null;
  username_chosen_at: string | null;
  last_rotated_at: string | null;
}

/** What kind of record a credential belongs to. */
export type PortalSubject = "student" | "staff";

/** How long an issued password can stand before it should be replaced. */
export const PASSWORD_MAX_AGE_DAYS = 180;

/**
 * The value written to a credential row's `password` column.
 *
 * Supabase Auth is the only place a usable password is held, and it stores a
 * hash. The `student_credentials` / `staff_credentials` rows used to mirror the
 * plaintext so the owner's screen could read it back — which meant a database
 * leak handed over every child's password, and any administrator could read one.
 *
 * That column now carries this marker instead. It is not a valid password
 * (the rules below require at least eight characters, a letter and a digit), so
 * a dump of the table discloses nothing. Whether an account still uses its
 * derived first password is recorded by `last_rotated_at`, which is a fact
 * about the account rather than a copy of the secret.
 */
export const PASSWORD_NOT_STORED = "*";

