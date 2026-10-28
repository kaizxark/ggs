/**
 * Everything to do with a portal account, behind one door.
 *
 * ## Why these three are one function and not three
 *
 * Vercel's Hobby plan allows twelve serverless functions per deployment and this
 * project already had nine. Splitting "my account", "everyone's accounts" and the
 * one-off backfill across three files took it to thirteen, and the deploy failed
 * with a message about function count — an unhelpful way to learn that a product
 * decision has a platform cost.
 *
 * They are genuinely one feature anyway: the lifecycle of a credential. One owns
 * it, one reads it, one repairs it. They are told apart by an `action` field, and
 * each keeps its own authorisation check, so merging them cost nothing in safety.
 *
 *   GET                   the signed-in person's own account
 *   PATCH                 change the signed-in person's username or password
 *   PATCH ?action=change  the same, spelled explicitly for clients that prefer it
 *   GET  ?action=all      every account in the school, with passwords.
 *                         Owner only, audited on every read.
 *   POST ?action=backfill give every pupil and member of staff a working account.
 *                         Owner only, audited.
 *
 * Authorisation is per action and never inherited: `all` and `backfill` check the
 * caller's immutable user id through `isSuperAdminId`, while the self-service
 * actions work only on the record this session is linked to.
 */

export const config = { runtime: "nodejs" };

import { resolveCaller, SERVICE_KEY, SUPABASE_URL } from "../shared/ai-auth.js";
import { isSuperAdminId } from "../shared/super-admin.js";
import { isValidUsername } from "../shared/username-lookup.js";
import {
  ddmmDate,
  isPlaceholderEmail,
  isUsableEmail,
  normaliseEmail,
  passwordProblem,
} from "../shared/portal-accounts.js";
import {
  changePortalCredentials,
  provisionPortalAccount,
  readAccountState,
  resetPupilPasswords,
  signInEmail,
} from "../shared/portal-server.js";
import {
  applySharedUsernameToPupils,
  readSharedUsername,
  sharedUsernameProblem,
  writeSharedUsername,
} from "../shared/shared-signin.js";

type Json = Record<string, unknown>;

/**
 * Addresses attached to real records so the flow can be tried end to end.
 *
 * The nth address goes to the nth record, chosen by USN so a re-run
 * reaches the same people.
 */
const TEST_ADDRESSES = [
  "kaizxark@gmail.com",
  "sincejuly7th@gmail.com",
  "kaizxark0@gmail.com",
];

/** How many rows one backfill will touch. A guard against a wrong org filter. */
const MAX_ROWS = 5000;

function fail(message: string, status: number, code = "error") {
  return Response.json({ error: code, message }, { status });
}

function headers(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function readJson<T>(res: Response): Promise<T[]> {
  try {
    return ((await res.json()) as T[]) ?? [];
  } catch {
    return [];
  }
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

/* ------------------------------------------------------------------ *
 * My own account
 * ------------------------------------------------------------------ */

async function ownAccount(req: Request): Promise<Response> {
  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");

  const state = await readAccountState(caller.id);
  if (!state) {
    return fail(
      "Your account is not set up yet. Ask an administrator to check it.",
      409,
      "no_account"
    );
  }

  return Response.json({
    account: {
      subject: state.subject,
      /**
       * The pupil's own record, so their dashboard can be built from the one
       * record they are allowed to read rather than from the roll call.
       *
       * Harmless for anyone else: it is their own row id, and the route that
       * consumes it resolves the relationship server-side before returning
       * anything, so it cannot be pointed at another child.
       */
      recordId: state.recordId,
      email: state.email,
      username: state.username,
      name: state.name,
      role: state.role,
    },
  });
}

async function changeCredentials(req: Request): Promise<Response> {
  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return fail("Bad request.", 400, "bad_request");
  }

  const state = await readAccountState(caller.id);
  if (!state) {
    return fail(
      "Your account is not set up yet. Ask an administrator to check it.",
      409,
      "no_account"
    );
  }

  const wantsUsername =
    typeof body.username === "string" && body.username.trim() !== "";
  const wantsPassword =
    typeof body.password === "string" && body.password !== "";

  if (!wantsUsername && !wantsPassword) {
    return fail("Nothing to change.", 400, "nothing_to_change");
  }

  if (
    wantsUsername &&
    !isValidUsername(String(body.username).trim().toLowerCase()) &&
    String(body.username).trim().toLowerCase() !== (await readSharedUsername())
  ) {
    /*
     * The school's shared sign-in name is allowed through even though it is
     * very often an email address, and an address is not a legal username. A
     * pupil whose name is still the shared one has to be able to save the form
     * without it being turned away.
     */
    return fail(
      "A username is 2 to 64 characters: letters, numbers, dots, dashes and underscores.",
      400,
      "invalid_username"
    );
  }
  if (wantsPassword) {
    const problem = passwordProblem(body.password);
    if (problem) return fail(problem, 400, "weak_password");
  }

  if (!body.currentPassword) {
    return fail(
      "Enter your current password to make this change.",
      400,
      "current_password_required"
    );
  }

  const verified = await verifyCurrentPassword(
    caller.email,
    String(body.currentPassword)
  );
  if (!verified) {
    return fail(
      "That current password is not right.",
      401,
      "current_password_wrong"
    );
  }

  const result = await changePortalCredentials({
    authUserId: state.authUserId,
    username: wantsUsername ? String(body.username) : null,
    password: wantsPassword ? String(body.password) : null,
    email: state.email || normaliseEmail(caller.email),
    studentId: state.subject === "student" ? state.recordId : null,
    // `state.recordId` for a member of staff is already `staff.id` — the row's
    // own primary key — which is exactly what `staff_credentials` keys on.
    staffId: state.subject === "staff" ? state.recordId : null,
    organisationId: state.organisationId,
  });

  if (!result.ok) {
    return fail(
      result.message ?? "That could not be saved.",
      400,
      result.error ?? "error"
    );
  }
  return Response.json({ ok: true });
}

/* ------------------------------------------------------------------ *
 * Everyone's accounts, and the one-off backfill
 * ------------------------------------------------------------------ */

async function allAccounts(req: Request): Promise<Response> {
  if (req.method !== "GET")
    return new Response("Method not allowed", { status: 405 });
  if (!SERVICE_KEY) {
    return fail(
      "This screen is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");
  if (!isSuperAdminId(caller.id)) {
    return fail(
      "Only the school owner can see account credentials.",
      403,
      "forbidden"
    );
  }

  const orgId = String(
    (
      await readJson<Json>(
        await rest(
          `profiles?select=organisation_id&id=eq.${encodeURIComponent(caller.id)}&limit=1`
        )
      )
    )[0]?.organisation_id ?? ""
  );
  if (!orgId)
    return fail(
      "Your account is not linked to a school.",
      403,
      "no_organisation"
    );

  const org = encodeURIComponent(orgId);

  const [studentCreds, staffCreds, students, staff, pupilProfiles, profiles] =
    await Promise.all([
      readJson<Json>(
        await rest(
          `student_credentials?select=student_id,username,password,issued_at&organisation_id=eq.${org}`
        )
      ),
      /*
       * Staff get the same treatment. The row exists from migration 007; it is
       * simply only written once somebody changes their password. Until then the
       * owner is shown the derived first password, which is correct.
       */
      readJson<Json>(
        await rest(
          `staff_credentials?select=staff_id,username,password,issued_at&organisation_id=eq.${org}`
        )
      ),
      readJson<Json>(
        await rest(
          `students?select=id,usn,first_name,last_name,email,date_of_birth&organisation_id=eq.${org}&order=usn.asc&limit=1000`
        )
      ),
      readJson<Json>(
        await rest(
          `staff?select=id,name,email,designation,employee_code,joined_on,profile_id&organisation_id=eq.${org}&order=name.asc&limit=1000`
        )
      ),
      /*
       * The name each pupil actually signs in with.
       *
       * It is on the profile rather than on the credential row, because the
       * shared sign-in name is the same for every pupil and the credential
       * row's name is unique within the school. A hundred copies of one name
       * cannot live in a column that refuses duplicates.
       */
      readJson<Json>(
        await rest(
          `profiles?select=id,username,student_id&student_id=not.is.null&limit=5000`
        )
      ),
      readJson<Json>(await rest(`profiles?select=id,username&limit=5000`)),
    ]);

  const credByStudent = new Map(
    studentCreds.map(row => [String(row.student_id), row])
  );
  const profileByStudent = new Map(
    pupilProfiles.map(row => [String(row.student_id), row])
  );
  const profileById = new Map(profiles.map(row => [String(row.id), row]));

  const pupilAccounts = students.map(pupil => {
    const id = String(pupil.id);
    const cred = credByStudent.get(id);
    const profile = profileByStudent.get(id);
    return {
      kind: "student" as const,
      recordId: id,
      name: `${String(pupil.first_name ?? "")} ${String(pupil.last_name ?? "")}`.trim(),
      detail: String(pupil.usn ?? ""),
      // The name they type, which is the shared name until they choose one of
      // their own.
      username: String(
        profile?.username ?? cred?.username ?? pupil.email ?? ""
      ).trim(),
      // Read from the row when there is one, so a password the pupil has since
      // changed is reported accurately rather than being recomputed from a date
      // they have moved on from.
      password: String(cred?.password ?? ddmmDate(pupil.date_of_birth) ?? ""),
      derived: !cred,
      email: normaliseEmail(pupil.email),
      issuedAt: String(cred?.issued_at ?? ""),
    };
  });

  const credByStaff = new Map(
    staffCreds.map(row => [String(row.staff_id), row])
  );

  const staffAccounts = staff.map(person => {
    const id = String(person.id);
    const cred = credByStaff.get(id);
    const profile = profileById.get(String(person.profile_id ?? ""));
    return {
      kind: "staff" as const,
      recordId: id,
      name: String(person.name ?? ""),
      detail: String(person.employee_code ?? person.designation ?? ""),
      // A recorded password wins over the derived one, so a member of staff who
      // has chosen their own is reported as they actually are.
      username: String(
        profile?.username ?? cred?.username ?? person.email ?? ""
      ).trim(),
      password: String(cred?.password ?? ddmmDate(person.joined_on) ?? ""),
      derived: !cred,
      email: normaliseEmail(person.email),
      issuedAt: String(cred?.issued_at ?? ""),
    };
  });

  const rows = [...pupilAccounts, ...staffAccounts];

  /*
   * Written before the response is sent, and its failure does not suppress the
   * answer: an audit gap must not be able to hide credentials from the one person
   * entitled to see them. The gap itself is reported in the payload so it is
   * visible rather than silent.
   */
  const audited = await writeAudit(orgId, caller.id, "credentials.read_all", {
    rows: rows.length,
    at: new Date().toISOString(),
  });

  return Response.json({
    accounts: rows,
    summary: {
      pupils: pupilAccounts.length,
      staff: staffAccounts.length,
      withAccount: rows.filter(row => Boolean(row.password)).length,
      /*
       * A record with no address, and a record with a generated placeholder,
       * are the same problem: there is no mailbox to reach. The placeholder
       * counts here, otherwise the figure reads as "everything is reachable"
       * for a school whose pupils are all still on generated addresses.
       */
      noAddress: [...students, ...staff].filter(
        row => !isUsableEmail(row.email) || isPlaceholderEmail(row.email)
      ).length,
    },
    audited,
  });
}

async function runBackfill(req: Request): Promise<Response> {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!SERVICE_KEY) {
    return fail(
      "This backfill is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");
  if (!isSuperAdminId(caller.id)) {
    return fail("Only the school owner can run this.", 403, "forbidden");
  }

  let body: Json = {};
  try {
    body = (await req.json().catch(() => ({}))) as Json;
  } catch {
    body = {};
  }

  const orgId = String(
    (
      await readJson<Json>(
        await rest(
          `profiles?select=organisation_id&id=eq.${encodeURIComponent(caller.id)}&limit=1`
        )
      )
    )[0]?.organisation_id ?? ""
  );
  if (!orgId)
    return fail(
      "Your account is not linked to a school.",
      403,
      "no_organisation"
    );

  const org = encodeURIComponent(orgId);
  const resetPassword = body.resetPassword === true;
  const dryRun = body.dryRun === true;
  const testAddresses: string[] = Array.isArray(body.testAddresses)
    ? body.testAddresses
        .map(value => normaliseEmail(value))
        .filter(isUsableEmail)
    : TEST_ADDRESSES;

  const [students, staff] = await Promise.all([
    readJson<Json>(
      await rest(
        `students?select=id,usn,first_name,last_name,email,date_of_birth&organisation_id=eq.${org}&order=usn.asc&limit=${MAX_ROWS}`
      )
    ),
    readJson<Json>(
      await rest(
        `staff?select=id,name,email,profile_id,designation,joined_on&organisation_id=eq.${org}&order=name.asc&limit=${MAX_ROWS}`
      )
    ),
  ]);

  if (students.length + staff.length > MAX_ROWS) {
    return fail(
      `That is more than ${MAX_ROWS} records. Run it for one school at a time.`,
      400,
      "too_many_rows"
    );
  }

  /*
   * Keyed by record id and holding the address. The reverse — an address keyed
   * by record id, looked up in a list of addresses — hands the first address to
   * every record, because the lookup keeps matching.
   */
  const testAssignments = new Map<string, string>();
  testAddresses.forEach((address, index) => {
    const pupil = students[index];
    if (pupil) testAssignments.set(String(pupil.id), address);
  });

  const tally = {
    pupils: { processed: 0, addressed: 0, provisioned: 0, failed: 0 },
    staff: { processed: 0, addressed: 0, provisioned: 0, failed: 0 },
  };
  const failures: string[] = [];
  const assignedTests: { email: string; record: string; password: string }[] =
    [];

  for (const pupil of students) {
    const id = String(pupil.id);
    const name =
      `${String(pupil.first_name ?? "")} ${String(pupil.last_name ?? "")}`.trim();
    const testAddress = testAssignments.get(id);
    const email = testAddress ?? signInEmail("student", id, pupil.email);

    if (email !== normaliseEmail(pupil.email)) {
      tally.pupils.addressed += 1;
      if (!dryRun) {
        const ok = await rest(
          `students?organisation_id=eq.${org}&id=eq.${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ email }),
          }
        );
        if (ok.ok) pupil.email = email;
      }
    }

    if (testAddress) {
      assignedTests.push({
        email: testAddress,
        record: `${name} (${String(pupil.usn ?? id)})`,
        password: ddmmOf(pupil.date_of_birth) ?? "no date on record",
      });
    }

    tally.pupils.processed += 1;
    if (dryRun) continue;

    const result = await provisionPortalAccount({
      subject: "student",
      recordId: id,
      organisationId: orgId,
      email: pupil.email,
      name,
      role: "student",
      birthDate: pupil.date_of_birth,
      actorId: caller.id,
      resetPassword,
    });
    if (result.ok) {
      if (result.created) tally.pupils.provisioned += 1;
    } else {
      tally.pupils.failed += 1;
      failures.push(`${name}: ${result.reason ?? "unknown"}`);
    }
  }

  for (const person of staff) {
    const id = String(person.id);
    const email = signInEmail("staff", id, person.email);
    const current = normaliseEmail(person.email);

    if (email !== current) {
      tally.staff.addressed += 1;
      if (!dryRun) {
        const ok = await rest(
          `staff?organisation_id=eq.${org}&id=eq.${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ email }),
          }
        );
        if (ok.ok) person.email = email;
      }
    }

    tally.staff.processed += 1;
    if (dryRun) continue;

    /*
     * A member of staff has no date of birth column and one cannot be added
     * without a migration, so the first password comes from the date they
     * joined. It is the only date their record carries, and it is shown to the
     * owner on the credentials screen so nobody has to guess it.
     */
    const result = await provisionPortalAccount({
      subject: "staff",
      recordId: id,
      organisationId: orgId,
      email: person.email,
      name: String(person.name ?? ""),
      /*
       * No role here, on purpose. `designation` is a job title — "Head of
       * Physics" — and `profiles.role` is an enum, so writing one into the
       * other is rejected by the database and the whole profile update is lost
       * with it. The access level lives on the profile and is set in Settings;
       * a backfill has no business changing it.
       */
      birthDate: person.joined_on,
      existingAuthUserId: person.profile_id ? String(person.profile_id) : null,
      actorId: caller.id,
      resetPassword,
    });
    if (result.ok) {
      if (result.created) tally.staff.provisioned += 1;
    } else {
      tally.staff.failed += 1;
      failures.push(
        `${String(person.name ?? id)}: ${result.reason ?? "unknown"}`
      );
    }
  }

  const audited = await writeAudit(orgId, caller.id, "portal.backfill", {
    dryRun,
    resetPassword,
    tally,
    testAddresses: assignedTests,
  });

  return Response.json({
    ok: true,
    dryRun,
    records: { pupils: students.length, staff: staff.length },
    tally,
    failures: failures.slice(0, 20),
    testAddresses: assignedTests,
    audited,
    note: "Each account signs in with its email address and its six-digit date. Passwords can be changed from Settings at any time.",
  });
}

/** Confirm the current password before a change is written. */
async function verifyCurrentPassword(
  email: string,
  password: string
): Promise<boolean> {
  const url =
    process.env.VITE_SUPABASE_URL || "https://fmlwzxmjrecbtvgraqqm.supabase.co";
  const anon =
    process.env.VITE_SUPABASE_ANON_KEY ||
    "sb_publishable_Y1oStHbYHErfX2FD6xyKeg_PXuVcQ1w";
  if (!email) return false;
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anon,
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ email, password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The six-digit form, mirrored here so the backfill report can show it. */
function ddmmOf(value: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(value ?? "")
      .trim()
      .slice(0, 10)
  );
  return m ? `${m[3]}${m[2]}${m[1].slice(2)}` : null;
}

/** Record that the owner looked at the credential list. */
async function writeAudit(
  orgId: string,
  actorId: string,
  action: string,
  detail: Json
): Promise<boolean> {
  try {
    const res = await rest("audit_logs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        organisation_id: orgId,
        actor_id: actorId,
        action,
        entity_type: "portal_account",
        entity_id: null,
        before_data: null,
        after_data: detail,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * The school's shared pupil sign-in name
 * ------------------------------------------------------------------ */

/**
 * One name for the whole roll call.
 *
 * A pupil types it, types their date of birth, and is in. It is held once, in
 * `public.settings`, rather than copied onto a hundred pupil records, because
 * a hundred copies of one string is a hundred things to keep in step.
 *
 * The owner sets it, and setting it puts every pupil who has not chosen a name
 * of their own onto it. A pupil who has claimed one keeps it: their name is
 * theirs, and the shared name does not reach them.
 */
async function sharedName(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    return fail(
      "This screen is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");
  if (!isSuperAdminId(caller.id)) {
    return fail(
      "Only the school owner can change the pupil sign-in name.",
      403,
      "forbidden"
    );
  }

  const current = await readSharedUsername();

  if (req.method === "GET") {
    return Response.json({
      sharedUsername: current,
      ...(await countPupilSignInNames(current)),
    });
  }

  if (req.method !== "PATCH" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Json = {};
  try {
    body = (await req.json().catch(() => ({}))) as Json;
  } catch {
    body = {};
  }

  const wanted = String(body.sharedUsername ?? "")
    .trim()
    .toLowerCase();
  const problem = sharedUsernameProblem(wanted);
  if (problem) {
    return fail(problem, 400, "invalid_shared_username");
  }

  const written = await writeSharedUsername(wanted);
  if (!written) {
    return fail("That could not be saved.", 500, "not_saved");
  }

  /*
   * The name is put on every pupil who has not chosen one of their own.
   *
   * This is what makes the scheme work: a pupil who has never set a username
   * signs in with the shared name and their date of birth, and a pupil who has
   * chosen a name is left alone.
   */
  const applied = await applySharedUsernameToPupils(wanted);

  const orgId = String(
    (
      await readJson<Json>(
        await rest(
          `profiles?select=organisation_id&id=eq.${encodeURIComponent(caller.id)}&limit=1`
        )
      )
    )[0]?.organisation_id ?? ""
  );
  const audited = orgId
    ? await writeAudit(orgId, caller.id, "portal.shared_username", {
        sharedUsername: wanted,
        applied,
      })
    : false;

  return Response.json({
    ok: true,
    sharedUsername: wanted,
    applied,
    audited,
    ...(await countPupilSignInNames(wanted)),
  });
}

/**
 * How many pupils are on the shared name, and how many have their own.
 *
 * The two numbers are what the owner needs to know: the first is the roll
 * call that answers to one name, and the second is the number of children who
 * have moved off it.
 */
async function countPupilSignInNames(
  shared: string
): Promise<{ onSharedName: number; withOwnName: number }> {
  const rows = await readJson<Json>(
    await rest(
      `profiles?select=username,student_id&student_id=not.is.null&limit=5000`
    )
  );
  let onSharedName = 0;
  let withOwnName = 0;
  for (const row of rows) {
    const name = String(row.username ?? "")
      .trim()
      .toLowerCase();
    if (shared && name === shared) onSharedName += 1;
    else withOwnName += 1;
  }
  return { onSharedName, withOwnName };
}

/* ------------------------------------------------------------------ *
 * The one-off that makes every pupil's password their date of birth
 * ------------------------------------------------------------------ */

/**
 * Put every pupil's password back to their date of birth.
 *
 * The school signs every pupil in with one name and their own date of birth.
 * This is what makes that true of every account rather than of the ones that
 * happened to be created after the rule was set.
 *
 * It overwrites credentials on purpose, so it is a named action the owner has
 * to ask for rather than something the backfill does as it goes, and it is
 * written to the audit log like every other owner action.
 */
async function resetPupilPasswordsAction(req: Request): Promise<Response> {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!SERVICE_KEY) {
    return fail(
      "This action is not configured on this deployment.",
      503,
      "not_configured"
    );
  }

  const caller = await resolveCaller(req);
  if (!caller) return fail("You must be signed in.", 401, "unauthenticated");
  if (!isSuperAdminId(caller.id)) {
    return fail("Only the school owner can do this.", 403, "forbidden");
  }

  const orgId = String(
    (
      await readJson<Json>(
        await rest(
          `profiles?select=organisation_id&id=eq.${encodeURIComponent(caller.id)}&limit=1`
        )
      )
    )[0]?.organisation_id ?? ""
  );
  if (!orgId) {
    return fail(
      "Your account is not linked to a school.",
      403,
      "no_organisation"
    );
  }

  const result = await resetPupilPasswords(orgId);
  const audited = await writeAudit(
    orgId,
    caller.id,
    "portal.reset_pupil_passwords",
    {
      reset: result.reset,
      skipped: result.skipped,
    }
  );

  return Response.json({
    ok: true,
    ...result,
    audited,
    message: `${result.reset} pupil${
      result.reset === 1 ? "" : "s"
    } now sign in with their date of birth.`,
  });
}

/* ------------------------------------------------------------------ *
 * Dispatch
 * ------------------------------------------------------------------ */

/**
 * The query string, however the runtime spelled the URL.
 *
 * `request.url` is absolute on the edge runtime but arrives as a bare path on
 * some Node invocations, and `new URL` throws outright on a relative one rather
 * than returning anything usable. That turned every request to this route into a
 * 500 with `Invalid URL` on the input `/api/portal-admin` — the whole portal
 * account API was dead in production while working fine locally.
 */
function queryOf(req: Request): URLSearchParams {
  try {
    return new URL(req.url).searchParams;
  } catch {
    const query = req.url.includes("?")
      ? req.url.slice(req.url.indexOf("?") + 1)
      : "";
    return new URLSearchParams(query);
  }
}

/**
 * One door, three things.
 *
 * The action is read from the query string for the two read-only variants and
 * from the method for the rest, because a browser cannot send a body with GET.
 */
export async function GET(req: Request): Promise<Response> {
  return dispatch(req);
}

export async function PATCH(req: Request): Promise<Response> {
  return dispatch(req);
}

export async function POST(req: Request): Promise<Response> {
  return dispatch(req);
}

/**
 * Vercel invokes a Node function through named HTTP methods.
 *
 * Exporting `default (req) => Response` looks equivalent but is not: on the
 * Node runtime the `req` is an `IncomingMessage`, so `req.url` is a bare path
 * (and `new URL` on it throws), `req.headers` is a plain object (and
 * `.get` on it throws), and the returned `Response` is discarded because nothing
 * ever writes to the response stream — the browser simply hangs until it times
 * out. Every request to this route failed, which is why a pupil's dashboard said
 * their account was not linked when in fact this endpoint had never answered.
 * Named methods get a real `Request` and their `Response` is used.
 */
async function dispatch(req: Request): Promise<Response> {
  const action = queryOf(req).get("action") ?? "";

  if (action === "all") {
    if (req.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    return allAccounts(req);
  }
  if (action === "backfill") {
    if (req.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    return runBackfill(req);
  }
  if (action === "shared-name") {
    if (
      req.method !== "GET" &&
      req.method !== "PATCH" &&
      req.method !== "POST"
    ) {
      return new Response("Method not allowed", { status: 405 });
    }
    return sharedName(req);
  }
  if (action === "reset-pupil-passwords") {
    return resetPupilPasswordsAction(req);
  }
  if (action === "change") {
    if (req.method !== "PATCH")
      return new Response("Method not allowed", { status: 405 });
    return changeCredentials(req);
  }
  if (req.method === "GET") return ownAccount(req);
  if (req.method === "PATCH") return changeCredentials(req);
  return new Response("Method not allowed", { status: 405 });
}
