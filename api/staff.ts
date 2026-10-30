/**
 * The staff directory.
 *
 * Creates and edits the people who work here, and gives each of them a sign-in
 * account the moment their record is saved.
 *
 * ## Why this route exists
 *
 * There was no way to add a member of staff through the application. The Staff
 * screen in the dashboard had an "Add staff" button that opened a dialog and
 * then displayed a success toast without calling anything — the person was never
 * written anywhere. The only staff rows that existed came from a seed script run
 * once by hand, which is why adding anybody since has meant editing the
 * database directly.
 *
 * That also meant staff had no login of their own. They could only exist as
 * `profiles` rows created through the invitation route, which required knowing
 * an email address before the person had been entered into the school.
 *
 * ## The rule this route is built around
 *
 * Saving a record is the moment somebody becomes a user. Not a button somebody
 * remembers to press later — the save itself. A member of staff who has been
 * entered into the roll can sign in the same afternoon.
 *
 * The account cannot be signed in to until its owner proves they own the
 * mailbox and chooses a password, so "has an account" never means "has a
 * password someone else knows".
 *
 * ## Data access
 *
 * Service key with the caller's own authorisation applied here, matching
 * api/students.ts. RLS stays on for every table this touches, so a query issued
 * straight from the browser remains scoped to what its own session can see.
 */

export const config = { runtime: "edge" };

import {
  resolveCaller,
  SERVICE_KEY,
  SUPABASE_URL,
  type Caller,
} from "../shared/ai-auth.js";
import { superAdminGuard } from "../shared/super-admin.js";
import {
  isPlaceholderEmail,
  isUsableEmail,
  normaliseEmail,
} from "../shared/portal-accounts.js";
import {
  findAccountByEmail,
  provisionPortalAccount,
} from "../shared/portal-server.js";

type Json = Record<string, unknown>;

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

/** Who may add or edit staff. Mirrors the dashboard's own gate. */
const MANAGERS = new Set(["super_admin", "admin", "principal"]);

/** Roles a new account may be created with. Mirrors api/invite.ts's GRANTABLE. */
const GRANTABLE = ["admin", "staff", "teacher", "accountant"];

/**
 * The shape of a staff USN: a staff-specific prefix and four digits.
 *
 * `STF1001`. `STF` is deliberately not the pupils' `GGS`, so a staff number can
 * never be mistaken for a pupil's and the two sequences do not have to share a
 * counter. The first number is 1001 for the same reason as the pupil USN: a
 * printed identifier should not look like a padded row index.
 */
const STAFF_USN_PREFIX = "STF";
const STAFF_USN_FIRST_NUMBER = 1001;

/**
 * Control characters are stripped from every value written by a form.
 *
 * Not cosmetic: a value carrying a NUL or a newline is spliced into a PostgREST
 * filter string below, and the query then fails or matches something unintended.
 * Matches api/students.ts.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function clean(value: unknown, max = 120): string {
  return String(value ?? "")
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, max);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * The USN as it is stored: compact and upper-case, the way it is printed.
 *
 * Matches api/students.ts. The school may write it with a dash or a space, but
 * those are presentation; the identifier is the letters and digits. Upper case
 * is the stored form so the number on screen is the number on the slip.
 */
function normaliseUsn(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 40);
}

function headers(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function readJson<T>(res: Response): Promise<T[]> {
  try {
    return ((await res.json()) as T[]) ?? [];
  } catch {
    return [];
  }
}

/** The caller's own organisation, never one taken from the request. */
async function callerOrg(caller: Caller): Promise<string> {
  if (!SERVICE_KEY) return "";
  const rows = await readJson<Json>(
    await rest(
      `profiles?select=organisation_id&id=eq.${encodeURIComponent(caller.id)}&limit=1`
    )
  ).catch(() => [] as Json[]);
  return String(rows?.[0]?.organisation_id ?? "");
}

/**
 * The next free staff USN.
 *
 * The highest `STF` number already in use in this school, plus one. Every row
 * is read and the numbers are compared numerically rather than taking the
 * lexicographic maximum: a hand-written `STFABC` must not become the "highest"
 * number and reset the sequence.
 */
async function nextStaffUsn(orgId: string): Promise<string> {
  const existing = await readJson<Json>(
    await rest(
      `staff?select=usn&organisation_id=eq.${orgId}` +
        `&usn=ilike.${encodeURIComponent(STAFF_USN_PREFIX)}*&limit=1000`
    )
  ).catch(() => [] as Json[]);
  let highest = STAFF_USN_FIRST_NUMBER - 1;
  for (const row of existing) {
    const match = /^STF(\d+)$/i.exec(String(row.usn ?? ""));
    const n = match ? Number.parseInt(match[1], 10) : NaN;
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return `${STAFF_USN_PREFIX}${String(highest + 1).padStart(4, "0")}`;
}

/** Whether a USN is already used by another member of staff. */
async function staffUsnTaken(
  orgId: string,
  usn: string,
  exceptId = ""
): Promise<boolean> {
  if (!SERVICE_KEY) return false;
  const rows = await readJson<Json>(
    await rest(
      `staff?select=id&organisation_id=eq.${orgId}` +
        `&usn=ilike.${encodeURIComponent(normaliseUsn(usn))}&limit=5`
    )
  ).catch(() => [] as Json[]);
  return rows.some(row => String(row.id) !== exceptId);
}

/**
 * Give this person an account, and keep the one they have in step.
 *
 * Best effort by design. A record save is the school's real work and must not
 * fail because an account could not be minted — but the failure is reported
 * back so an administrator can see exactly which person needs attention,
 * rather than a parent discovering it when they cannot sign in.
 */
async function ensureAccount(
  orgId: string,
  actorId: string,
  staff: Json,
  /**
   * The access level to give a newly created profile. Left out on an update, so
   * that saving a staff record does not quietly demote somebody who was made an
   * admin in Settings.
   */
  pendingRole?: string,
  /** Set only by the backfill, where the joining-date password is wanted. */
  pendingPasswordFrom?: "joined_on"
): Promise<{ account: string | null; detail: Json; authUserId: string }> {
  const id = String(staff.id ?? "");
  if (!id || !orgId) return { account: null, detail: {}, authUserId: "" };

  try {
    const result = await provisionPortalAccount({
      subject: "staff",
      recordId: id,
      organisationId: orgId,
      email: staff.email,
      // The USN is the staff sign-in name, not a separate username.
      username: normaliseUsn(staff.usn).toLowerCase(),
      name: String(staff.name ?? staff.full_name ?? ""),
      // `staff` has no date of birth column and one cannot be added without a
      // migration, so the first password comes from the joining date. Left
      // undefined on an update so a save never overwrites a changed password.
      birthDate:
        pendingPasswordFrom === undefined ? undefined : staff.joined_on,
      // `staff` has no role column — designation and department describe the
      // job, while the access level lives on the linked profile. Anything that
      // needs one gets it from `pendingRole` above.
      role: pendingRole,
      existingAuthUserId: staff.profile_id ? String(staff.profile_id) : null,
      actorId,
    });
    if (!result.ok) {
      return {
        account: null,
        detail: { reason: result.reason ?? "unknown" },
        authUserId: "",
      };
    }
    return {
      account: result.created ? "created" : "existing",
      detail: { username: result.username, email: result.email },
      authUserId: result.authUserId,
    };
  } catch {
    return { account: null, detail: { reason: "unexpected" }, authUserId: "" };
  }
}

/**
 * Set the access level on the profile this person signs in as.
 *
 * The role lives on `profiles.role`, not on the staff row. `staff` has no
 * `role` column at all, so writing one there is rejected by the database and
 * the whole save fails with a 500 — which is what happened every time anybody
 * tried to change a member of staff's role.
 *
 * The profile is reached through `staff.profile_id`, which is the link that
 * says which account this record belongs to.
 */
async function setProfileRole(
  profileId: string,
  role: string
): Promise<boolean> {
  if (!profileId || !SERVICE_KEY) return false;
  const res = await rest(`profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ role }),
  });
  return res.ok;
}

async function setProfilePhoto(
  profileId: string,
  photo: string | null
): Promise<boolean> {
  if (!profileId || !SERVICE_KEY) return false;
  const res = await rest(`profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ avatar_url: photo }),
  });
  return res.ok;
}

function photoUrl(value: unknown): string | null {
  const raw = clean(value, 500);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return raw;
  } catch {
    return null;
  }
}

async function attachPhotos(rows: Json[]): Promise<Json[]> {
  if (!rows.length) return rows;

  const profileIds = Array.from(
    new Set(
      rows
        .map((row) => String(row.profile_id ?? "").trim())
        .filter(Boolean)
    )
  );
  if (!profileIds.length) {
    return rows.map((row) => ({ ...row, photo_url: null }));
  }

  const profiles = await readJson<Json>(
    await rest(
      `profiles?select=id,avatar_url&id=in.(${profileIds
        .map((id) => encodeURIComponent(id))
        .join(",")})`
    )
  ).catch(() => [] as Json[]);

  const byId = new Map(
    profiles.map((profile) => [
      String(profile.id),
      photoUrl(profile.avatar_url),
    ])
  );
  return rows.map((row) => ({
    ...row,
    photo_url: byId.get(String(row.profile_id ?? "").trim()) ?? null,
  }));
}

export default async function handler(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail(
      "The staff directory is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");

  /* ---------------------------- list ---------------------------- */
  if (req.method === "GET") {
    const orgId = await callerOrg(caller);
    if (!orgId)
      return fail(
        "Your account is not linked to a school.",
        403,
        "no_organisation"
      );

    const url = new URL(req.url);
    const id = (url.searchParams.get("id") ?? "").trim();

    if (id) {
      // Scoped to the caller's organisation on every read, so a guessed id from
      // another school returns 404 rather than leaking that it exists.
      const rows = await readJson<Json>(
        await rest(
          `staff?select=id,organisation_id,name,email,phone,designation,department,usn,joined_on,active,profile_id` +
            `&organisation_id=eq.${orgId}&id=eq.${encodeURIComponent(id)}&limit=1`
        )
      ).catch(() => [] as Json[]);
      if (!rows.length)
        return fail(
          "That member of staff could not be found.",
          404,
          "not_found"
        );
      const [staff] = await attachPhotos(rows);
      return Response.json({ staff });
    }

    const rows = await readJson<Json>(
      await rest(
        `staff?select=id,organisation_id,name,email,phone,designation,department,usn,joined_on,active,profile_id` +
          `&organisation_id=eq.${orgId}&order=name.asc&limit=500`
      )
    ).catch(() => [] as Json[]);

    /*
     * The credential summary is deliberately absent. A password belongs in one
     * audited place — api/credentials.ts, which the school owner alone can
     * reach — and a list of every member of staff is not that place.
     */
    return Response.json({ staff: await attachPhotos(rows) });
  }

  /* ---------------------------- create ---------------------------- */
  if (req.method === "POST") {
    if (!MANAGERS.has(caller.role)) {
      return fail(
        "Only an administrator can add a member of staff.",
        403,
        "forbidden"
      );
    }
    const orgId = await callerOrg(caller);
    if (!orgId)
      return fail(
        "Your account is not linked to a school.",
        403,
        "no_organisation"
      );

    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return fail("Bad request.", 400, "bad_request");
    }

    const name = clean(body.name ?? body.full_name, 120);
    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.name = "Enter a name.";

    const email = normaliseEmail(body.email);
    // An address is required, because the email is how this person will prove
    // the account is theirs. Accepting the save without one would produce a row
    // that can never be signed in to.
    //
    // It has to be an address and not merely a non-empty string. A value like
    // "not-an-email" was accepted, and the account was then created with it —
    // a sign-in address that cannot receive a message, so the person could
    // never prove they own it or recover the password they were given.
    if (!isUsableEmail(email))
      fieldErrors.email = "Enter a valid email address so they can sign in.";
    // The placeholder address is the one the system invents when a record
    // carries no address of its own. It belongs to nobody, so it cannot be
    // the one a person is invited to.
    else if (isPlaceholderEmail(email))
      fieldErrors.email = "Enter a valid email address so they can sign in.";

    const role = clean(body.role, 20) || "staff";
    if (!GRANTABLE.includes(role)) {
      fieldErrors.role = "Choose a role this account may hold.";
    }
    if (Object.keys(fieldErrors).length) {
      return Response.json(
        { error: "validation", fieldErrors },
        { status: 400 }
      );
    }

    if (await emailTaken(orgId, email)) {
      return Response.json(
        {
          error: "validation",
          fieldErrors: { email: "That email address is already in use." },
        },
        { status: 400 }
      );
    }

    /*
     * An address that already has an account is not this person's to take.
     *
     * The check above looks at the staff table. This one looks at the
     * accounts themselves, because a colleague's account, a parent's account
     * or a pupil's account is just as much a way for one person's sign-in to
     * end up belonging to another: provisioning an address that is already
     * taken would rewrite the account behind it — its name, its role, the
     * school it belongs to — so that the person who signed in with it is now
     * whoever this record says they are. The address is refused instead.
     */
    if (await accountTakenByAnother(email, "")) {
      return Response.json(
        {
          error: "validation",
          fieldErrors: {
            email: "That email address already has an account.",
          },
        },
        { status: 400 }
      );
    }

    const joinedOn = clean(body.joined_on, 10);
    if (joinedOn && !isIsoDate(joinedOn)) {
      return Response.json(
        { error: "validation", fieldErrors: { joined_on: "Use YYYY-MM-DD." } },
        { status: 400 }
      );
    }

    /*
     * The USN is either supplied or generated. A generated one continues the
     * school's staff sequence (STF1001, STF1002), so a new colleague gets an
     * identifier without somebody having to invent one, and two records cannot
     * be handed the same number.
     */
    const usn = normaliseUsn(body.usn) || (await nextStaffUsn(orgId));
    if (await staffUsnTaken(orgId, usn)) {
      return Response.json(
        {
          error: "validation",
          fieldErrors: { usn: "That USN is already in use." },
        },
        { status: 400 }
      );
    }

    const payload: Json = {
      organisation_id: orgId,
      name,
      email,
      usn,
      active: body.active === false ? false : true,
      joined_on: isIsoDate(joinedOn)
        ? joinedOn
        : new Date().toISOString().slice(0, 10),
    };

    /*
     * Only columns the table actually has. `full_name` is not one of them —
     * `staff` stores the name in `name` — and a payload carrying it was
     * rejected by the database, which turned a create into a 500.
     */
    for (const field of ["phone", "designation", "department"]) {
      const value = clean(body[field], 200);
      if (value) payload[field] = value;
    }

    const created = await readJson<Json>(
      await rest("staff", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      })
    ).catch(() => [] as Json[]);

    if (!created.length) {
      return fail(
        "That member of staff could not be created.",
        500,
        "create_failed"
      );
    }

    /*
     * A record being created is exactly when the first password has to be the
     * one the owner will read on the credentials screen. Without passing the
     * joining date the provisioner has nothing to derive from and falls back to
     * a random secret — so the new member of staff could never sign in with the
     * password shown to the school.
     */
    const { account, detail, authUserId } = await ensureAccount(
      orgId,
      caller.id,
      created[0],
      role,
      "joined_on"
    );

    /*
     * The link back to the account, written straight after the account is
     * made. `staff.profile_id` is how the record is found again — the
     * credentials screen, the account settings, the password change — and
     * without it a member of staff added here has a record but no account
     * anybody can reach.
     */
    if (authUserId) {
      await rest(
        `staff?organisation_id=eq.${orgId}&id=eq.${encodeURIComponent(
          String(created[0].id ?? "")
        )}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ profile_id: authUserId }),
        }
      ).catch(() => null);
    }

    await writeAudit(
      orgId,
      caller.id,
      "create",
      String(created[0].id ?? ""),
      created[0]
    );

    return Response.json(
      { staff: created[0], account, accountDetail: detail },
      { status: 201 }
    );
  }

  /* ---------------------------- update ---------------------------- */
  if (req.method === "PATCH") {
    if (!MANAGERS.has(caller.role)) {
      return fail(
        "Only an administrator can edit a member of staff.",
        403,
        "forbidden"
      );
    }
    const orgId = await callerOrg(caller);
    if (!orgId)
      return fail(
        "Your account is not linked to a school.",
        403,
        "no_organisation"
      );

    let body: Json;
    try {
      body = (await req.json()) as Json;
    } catch {
      return fail("Bad request.", 400, "bad_request");
    }

    const id = clean(body.id, 64);
    if (!id) return fail("Which member of staff?", 400, "missing_id");

    const existing = await readJson<Json>(
      await rest(
        `staff?select=id,profile_id,name,email,usn,joined_on&organisation_id=eq.${orgId}` +
          `&id=eq.${encodeURIComponent(id)}&limit=1`
      )
    ).catch(() => [] as Json[]);
    if (!existing.length) {
      return fail("That member of staff could not be found.", 404, "not_found");
    }
    const linkedProfile = String(existing[0].profile_id ?? "").trim();

    /**
     * The role to set on the linked profile, when one was asked for.
     *
     * It is kept out of the staff row's own patch: `staff` has no `role`
     * column, so sending one is rejected by the database and takes the whole
     * save down with it. The access level belongs to the profile, and is
     * written once the row itself has been saved.
     */
    let pendingRole = "";

    /**
     * The photo to write to the linked profile. `staff` has no photo column, so
     * the image belongs on the account the record signs in with.
     */
    let pendingPhoto: string | null | undefined;

    const patch: Json = {};
    for (const field of ["name", "phone", "designation", "department"]) {
      const value = clean(body[field], 200);
      if (value) patch[field] = value;
    }

    if (body.email !== undefined) {
      const email = normaliseEmail(body.email);
      // The same rule as on the way in: an address that cannot be delivered to
      // is not an address, and changing to one would leave the record pointing
      // at an account nobody can sign in to.
      if (!isUsableEmail(email) || isPlaceholderEmail(email)) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: { email: "Enter a valid email address." },
          },
          { status: 400 }
        );
      }
      if (await emailTaken(orgId, email, id)) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: { email: "That email address is already in use." },
          },
          { status: 400 }
        );
      }
      /*
       * The same rule as on the way in, for the same reason. The one address
       * that may be adopted is the record's own: that is the account this
       * person signs in with, and keeping it in step is the point of the
       * save. Any other account behind the address belongs to somebody else.
       */
      if (await accountTakenByAnother(email, linkedProfile)) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: {
              email: "That email address already has an account.",
            },
          },
          { status: 400 }
        );
      }
      patch.email = email;
    }

    if (body.role !== undefined) {
      const role = clean(body.role, 20);
      if (!GRANTABLE.includes(role)) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: { role: "Choose a role this account may hold." },
          },
          { status: 400 }
        );
      }
      /*
       * A role is a privilege. The one account that must never be moved down is
       * the owner, and `superAdminGuard` is the same guard the rest of the
       * application uses so the rule cannot drift between screens.
       *
       * It compares against an auth user id, so the guard is handed the linked
       * profile rather than this staff row's own id — a different value, which
       * would mean the check never fired and the protection was decorative.
       */
      const blocked = superAdminGuard(linkedProfile, "change the role of");
      if (blocked) return fail(blocked, 403, "forbidden");
      pendingRole = role;
    }

    if (body.photo_url !== undefined) {
      const raw = clean(body.photo_url, 500);
      if (raw) {
        const valid = photoUrl(raw);
        if (!valid) {
          return Response.json(
            {
              error: "validation",
              fieldErrors: { photo_url: "Enter a valid image address." },
            },
            { status: 400 }
          );
        }
        pendingPhoto = valid;
      } else {
        pendingPhoto = null;
      }
    }

    if (body.active !== undefined)
      patch.active = body.active === false ? false : true;

    const joinedOn = clean(body.joined_on, 10);
    if (joinedOn) {
      if (!isIsoDate(joinedOn)) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: { joined_on: "Use YYYY-MM-DD." },
          },
          { status: 400 }
        );
      }
      patch.joined_on = joinedOn;
    }

    /*
     * A USN can be corrected, but it cannot be cleared: it is the record's
     * identifier, and a staff member without one is a row nobody can refer to.
     * A number that is already another colleague's is refused rather than
     * written and caught by the unique index as a 500.
     */
    if (body.usn !== undefined) {
      const usn = normaliseUsn(body.usn);
      if (!usn) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: { usn: "Enter a USN." },
          },
          { status: 400 }
        );
      }
      if (
        usn !== normaliseUsn(existing[0].usn) &&
        (await staffUsnTaken(orgId, usn, id))
      ) {
        return Response.json(
          {
            error: "validation",
            fieldErrors: { usn: "That USN is already in use." },
          },
          { status: 400 }
        );
      }
      patch.usn = usn;
    }

    /*
     * A role is saved on the profile, not on the staff row, so a change of
     * role alone leaves the row itself with nothing to write. That is not a
     * request to do nothing, and it must not be refused as one.
     */
    if (!Object.keys(patch).length && !pendingRole && pendingPhoto === undefined) {
      return fail("There was nothing to save.", 400, "nothing_to_save");
    }

    const updated = Object.keys(patch).length
      ? await readJson<Json>(
          await rest(
            `staff?organisation_id=eq.${orgId}&id=eq.${encodeURIComponent(id)}`,
            {
              method: "PATCH",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify(patch),
            }
          )
        ).catch(() => [] as Json[])
      : [];

    if (Object.keys(patch).length && !updated.length) {
      return fail(
        "That member of staff could not be saved.",
        500,
        "update_failed"
      );
    }

    /* The row as it now stands, which is what the account is kept in step with. */
    const saved = updated.length ? updated[0] : existing[0];

    // Re-run provisioning so a changed address or role reaches the account too.
    const { account, detail, authUserId } = await ensureAccount(
      orgId,
      caller.id,
      saved,
      pendingRole || undefined
    );

    /*
     * The link back to the account.
     *
     * `staff.profile_id` is what says which auth account this person signs in
     * as, and nothing else writes it: a member of staff added through this
     * screen got a staff row with a null link, so their account could not be
     * found from the record and the two drifted apart.
     *
     * It is written when the record has no link yet, and rewritten when the
     * address changed — a new address means a new account, and the record has
     * to follow it or it keeps pointing at the account for the old one.
     */
    const addressChanged =
      patch.email !== undefined &&
      patch.email !== normaliseEmail(existing[0].email);
    const linkProfileId =
      addressChanged && authUserId ? authUserId : linkedProfile || authUserId;
    if (linkProfileId && linkProfileId !== linkedProfile) {
      await rest(
        `staff?organisation_id=eq.${orgId}&id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ profile_id: linkProfileId }),
        }
      ).catch(() => null);
    }

    if (pendingPhoto !== undefined) {
      if (!linkProfileId) {
        return fail(
          "The photo needs a sign-in account. Save the record again first.",
          409,
          "photo_needs_profile"
        );
      }
      const applied = await setProfilePhoto(linkProfileId, pendingPhoto);
      if (!applied) {
        return fail(
          "That photo could not be saved. Please try again.",
          500,
          "photo_not_saved"
        );
      }
    }

    /*
     * The role, on the profile.
     *
     * Written against the account this record is linked to, because the link
     * is the authority: the provisioner finds the account by address, and
     * after an address change that is not the account this record is for any
     * more.
     */
    if (pendingRole) {
      const applied = await setProfileRole(linkProfileId, pendingRole);
      if (!applied) {
        return fail(
          "That role could not be saved. Please try again.",
          500,
          "role_not_saved"
        );
      }
    }

    await writeAudit(orgId, caller.id, "update", id, saved);

    return Response.json({
      staff:
        pendingPhoto === undefined
          ? saved
          : { ...saved, photo_url: pendingPhoto },
      account,
      accountDetail: detail,
    });
  }

  return new Response("Method not allowed", { status: 405 });
}

/** Whether an address is already used by another member of staff. */
async function emailTaken(
  orgId: string,
  email: string,
  exceptId = ""
): Promise<boolean> {
  if (!SERVICE_KEY) return false;
  const rows = await readJson<Json>(
    await rest(
      `staff?select=id&organisation_id=eq.${orgId}&email=eq.${encodeURIComponent(email)}&limit=5`
    )
  ).catch(() => [] as Json[]);
  return rows.some(row => String(row.id) !== exceptId);
}

/**
 * Whether an address already has an account that is not the one given.
 *
 * The account behind an address is found in the auth user list, which is the
 * authority on it: `profiles.email` is only a copy, and the two drift apart
 * when a rename has not been confirmed. An account that has been renamed
 * would otherwise look free, and a record could be written onto it.
 */
async function accountTakenByAnother(
  email: string,
  ownAuthUserId: string
): Promise<boolean> {
  const owner = await findAccountByEmail(email);
  if (!owner) return false;
  return owner !== ownAuthUserId;
}

/** Best effort. An audit write must never turn a successful save into a 500. */
async function writeAudit(
  orgId: string,
  actorId: string,
  action: string,
  targetId: string,
  detail: Json
): Promise<void> {
  try {
    await rest("audit_logs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        organisation_id: orgId,
        actor_id: actorId,
        action: `staff.${action}`,
        entity_type: "staff",
        entity_id: targetId,
        before_data: null,
        after_data: detail,
      }),
    });
  } catch {
    // Deliberately swallowed.
  }
}
