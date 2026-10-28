import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashOtp,
  OTP_MAX_ATTEMPTS,
  PASSWORD_OTP_PREFIX,
} from "../shared/portal-accounts";

/**
 * The sign-in code route is the one door into the product for a parent and a
 * pupil with no password, so it is treated here as an attack surface rather
 * than as a feature: the same answer for every address, a code that is never
 * stored in the clear, a code that dies after one use, and a sweep that runs
 * out of attempts long before it runs out of numbers.
 */

const mail = vi.hoisted(() => {
  const sent: { to: string; subject: string; text: string; html: string }[] =
    [];
  return { sent, fail: { value: false } };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (message: {
        to: string;
        subject: string;
        text: string;
        html: string;
      }) => {
        if (mail.fail.value) throw new Error("relay refused the message");
        mail.sent.push(message);
        return { messageId: "test-message" };
      },
    }),
  },
}));

import { POST } from "./otp";

const realFetch = globalThis.fetch;

/* ------------------------------------------------------------------ *
 * A small stand-in for the parts of Supabase this route touches
 * ------------------------------------------------------------------ */

interface CodeRow {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  created_at: string;
}

interface Store {
  profiles: Record<string, unknown>[];
  students: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  authUsers: { id: string; email: string }[];
  codes: CodeRow[];
  settings: { key: string; value: unknown }[];
}

let store: Store;

function emptyStore(): Store {
  return {
    profiles: [],
    students: [],
    staff: [],
    authUsers: [],
    codes: [],
    settings: [],
  };
}

/** Pull the value out of a PostgREST filter such as `email=eq.a@b.com`. */
function filterValue(url: string, column: string): string | null {
  const match = new RegExp(`(?:[?&])${column}=eq\\.([^&]+)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function stubNetwork() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = String(init?.method ?? "GET");

    if (url.includes("/rest/v1/profiles")) {
      const byEmail = filterValue(url, "email");
      const byId = filterValue(url, "id");
      const byStudent = filterValue(url, "student_id");
      const rows = store.profiles.filter(row =>
        byEmail
          ? String(row.email).toLowerCase() === byEmail.toLowerCase()
          : byId
            ? String(row.id) === byId
            : byStudent
              ? String(row.student_id) === byStudent
              : true
      );
      return Response.json(rows);
    }

    if (url.includes("/rest/v1/settings")) {
      const byKey = filterValue(url, "key");
      return Response.json(
        store.settings.filter(row => !byKey || String(row.key) === byKey)
      );
    }

    if (url.includes("/rest/v1/students")) {
      const byId = filterValue(url, "id");
      return Response.json(
        store.students.filter(row => !byId || String(row.id) === byId)
      );
    }

    if (url.includes("/rest/v1/staff")) {
      const byProfile = filterValue(url, "profile_id");
      return Response.json(
        store.staff.filter(
          row => !byProfile || String(row.profile_id) === byProfile
        )
      );
    }

    if (url.includes("/rest/v1/login_otp_codes")) {
      if (method === "POST") {
        const body = JSON.parse(String(init?.body)) as Partial<CodeRow>;
        const row: CodeRow = {
          id: String(body.id),
          email: String(body.email),
          code_hash: String(body.code_hash),
          expires_at: String(body.expires_at),
          attempts: 0,
          consumed_at: null,
          created_at: new Date().toISOString(),
        };
        store.codes.push(row);
        return Response.json([row], { status: 201 });
      }
      if (method === "PATCH") {
        const byId = filterValue(url, "id");
        const body = JSON.parse(String(init?.body)) as Partial<CodeRow>;
        const row = store.codes.find(candidate => candidate.id === byId);
        if (row) Object.assign(row, body);
        return Response.json(row ? [row] : []);
      }
      if (method === "DELETE") {
        const byId = filterValue(url, "id");
        store.codes = store.codes.filter(row => row.id !== byId);
        return new Response("", { status: 204 });
      }
      const byEmail = filterValue(url, "email");
      return Response.json(
        store.codes
          .filter(row => !byEmail || row.email === byEmail)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
    }

    if (url.includes("/auth/v1/admin/users")) {
      return Response.json({ users: store.authUsers });
    }

    if (url.includes("/auth/v1/admin/generate_link")) {
      return Response.json({
        action_link:
          "https://project.supabase.co/auth/v1/verify?token=token-abc&type=magiclink",
      });
    }

    if (url.includes("/auth/v1/verify")) {
      return Response.json({
        access_token: "session-access-token",
        refresh_token: "session-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
      });
    }

    return Response.json([]);
  }) as typeof fetch;
}

/**
 * A fresh client identity for every call.
 *
 * The route throttles per address in a map that lives for as long as the
 * module does, so a whole file's worth of requests would otherwise arrive
 * from one "client" and be turned away as abuse long before any of the
 * behaviour under test was reached.
 */
let clientNumber = 0;

function post(body: unknown) {
  clientNumber += 1;
  return POST(
    new Request("https://erp.test/api/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `203.0.113.${clientNumber}`,
      },
      body: JSON.stringify(body),
    })
  );
}

/** The six digits that were mailed out. */
function mailedCode(): string {
  const message = mail.sent[mail.sent.length - 1];
  const match = /\b(\d{6})\b/.exec(message.text);
  if (!match) throw new Error("no code found in the mailed message");
  return match[1];
}

beforeEach(() => {
  store = emptyStore();
  mail.sent.length = 0;
  mail.fail.value = false;
  process.env.SMTP_HOST = "smtp.test";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "school@test.invalid";
  process.env.SMTP_PASS = "secret";
  process.env.SMTP_FROM = "school@test.invalid";
  stubNetwork();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
});

/* ------------------------------------------------------------------ */

const STAFF_PROFILE = {
  id: "profile-1",
  organisation_id: "org-1",
  full_name: "Rajesh Menon",
  email: "rajesh.menon@myschool.edu.in",
  role: "admin",
  username: "rajesh.menon",
};

describe("POST /api/otp — asking for a code", () => {
  it("answers an unknown address exactly as it answers a known one", async () => {
    // A sign-in screen that answers differently is a list of who has an
    // account, so the two replies have to be byte for byte the same.
    store.profiles.push(STAFF_PROFILE);
    const known = await post({ email: "rajesh.menon@myschool.edu.in" });
    const knownBody = await known.json();

    const unknown = await post({ email: "nobody@nowhere.invalid" });
    const unknownBody = await unknown.json();

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(knownBody).toEqual(unknownBody);
  });

  it("sends no mail and issues no code for an address nobody holds", async () => {
    const res = await post({ email: "nobody@nowhere.invalid" });
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
    expect(store.codes).toHaveLength(0);
  });

  it("stores only a hash of the code, never the code itself", async () => {
    store.profiles.push(STAFF_PROFILE);
    await post({ email: "rajesh.menon@myschool.edu.in" });

    const code = mailedCode();
    const row = store.codes[0];
    expect(row.code_hash).not.toBe(code);
    expect(row.code_hash).toHaveLength(64);
    // The hash really is of that code, salted with the row's own id.
    expect(row.code_hash).toBe(await hashOtp(code, row.id));
  });

  it("mails the code to the address the account actually holds", async () => {
    store.profiles.push(STAFF_PROFILE);
    await post({ email: "rajesh.menon@myschool.edu.in" });
    expect(mail.sent[0].to).toBe("rajesh.menon@myschool.edu.in");
  });

  it("refuses a value that is neither an address, a name nor a USN", async () => {
    const res = await post({ email: "not a valid thing!" });
    expect(res.status).toBe(400);
    expect(mail.sent).toHaveLength(0);
  });

  it("answers an unknown name exactly as it answers an unknown address", async () => {
    // The field takes an identifier now, so a name belonging to nobody is a
    // perfectly ordinary thing to type — and it must not be distinguishable
    // from an address belonging to nobody.
    const unknownName = await post({ email: "nobody.at.all" });
    const unknownAddress = await post({ email: "nobody@nowhere.invalid" });
    expect(unknownName.status).toBe(200);
    expect(unknownAddress.status).toBe(200);
    expect(await unknownName.json()).toEqual(await unknownAddress.json());
  });

  it("will not send a second code inside the cooldown", async () => {
    store.profiles.push(STAFF_PROFILE);
    const first = await post({ email: "rajesh.menon@myschool.edu.in" });
    expect(first.status).toBe(200);

    const second = await post({ email: "rajesh.menon@myschool.edu.in" });
    expect(second.status).toBe(429);
    // One message, not two: a second would be the school firing mail at
    // somebody else's inbox on a loop.
    expect(mail.sent).toHaveLength(1);
  });

  it("withdraws the code when the mail could not be sent", async () => {
    store.profiles.push(STAFF_PROFILE);
    mail.fail.value = true;

    const res = await post({ email: "rajesh.menon@myschool.edu.in" });
    // The reply is the same one everybody gets, so a bounce cannot be used to
    // tell a registered address from an unregistered one.
    expect(res.status).toBe(200);
    expect(store.codes).toHaveLength(0);
  });
});

describe("POST /api/otp — password-required roles cannot ask for a code", () => {
  const PUPIL = {
    id: "profile-2",
    organisation_id: "org-1",
    full_name: "Priya Menon",
    email: "student-priya-3b@gks.invalid",
    role: "student",
    username: "adm26270042",
    student_id: "student-1",
  };

  beforeEach(() => {
    store.profiles.push(PUPIL);
    store.students.push({
      id: "student-1",
      usn: "adm26270042",
      first_name: "Priya",
      last_name: "Menon",
      email: "kaizxark@gmail.com",
      guardian_email: "parent@example.com",
      guardian_name: "Anita Menon",
    });
  });

  it("sends no code for a pupil who asks by address", async () => {
    const res = await post({ email: "student-priya-3b@gks.invalid" });
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
    expect(store.codes).toHaveLength(0);
    expect((await res.json()).message).toContain("username");
  });

  it("sends no code for a pupil who asks by USN", async () => {
    const res = await post({ identifier: "adm26270042" });
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
    expect(store.codes).toHaveLength(0);
  });

  it("sends no code for a member of staff", async () => {
    store.profiles.push({
      id: "profile-staff",
      organisation_id: "org-1",
      full_name: "Meera Iyer",
      email: "meera.auth@example.com",
      role: "staff",
      username: "emp2012026",
      student_id: null,
    });
    store.staff.push({
      id: "staff-1",
      profile_id: "profile-staff",
      name: "Dr. Meera Iyer",
      email: "sincejuly7th@gmail.com",
    });

    const res = await post({ email: "meera.auth@example.com" });
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
    expect(store.codes).toHaveLength(0);
  });
});

describe("POST /api/otp — verifying the second factor", () => {
  const PUPIL = {
    id: "profile-3",
    organisation_id: "org-1",
    full_name: "Imran Khan",
    email: "imran.auth@example.com",
    role: "student",
    username: "adm26270042",
    student_id: "student-9",
  };

  beforeEach(() => {
    store.profiles.push(PUPIL);
    store.students.push({
      id: "student-9",
      usn: "adm26270042",
      first_name: "Imran",
      last_name: "Khan",
      email: "kaizxark0@gmail.com",
      guardian_email: "family@example.com",
      guardian_name: "Rashid Khan",
    });
  });

  async function insertCode(code: string, hash: string) {
    const id = "code-student";
    store.codes.push({
      id,
      email: PUPIL.email,
      code_hash: hash,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      attempts: 0,
      consumed_at: null,
      created_at: new Date().toISOString(),
    });
    return id;
  }

  it("accepts a code that was issued after the password", async () => {
    const code = "123456";
    const id = await insertCode(code, "");
    store.codes[0].code_hash = PASSWORD_OTP_PREFIX + (await hashOtp(code, id));

    const res = await post({
      identifier: "adm26270042",
      code,
      action: "verify",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.session.access_token).toBe("session-access-token");
    expect(body.subject.kind).toBe("student");
  });

  it("refuses a code that was not issued after the password", async () => {
    const code = "123456";
    await insertCode(code, await hashOtp(code, "code-student"));

    const res = await post({
      identifier: "adm26270042",
      code,
      action: "verify",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/otp — the name every pupil shares", () => {
  beforeEach(() => {
    store.settings.push({
      key: "portal_shared_username",
      value: "kaizxark@gmail.com",
    });
    store.profiles.push({
      id: "profile-owner",
      organisation_id: "org-1",
      full_name: "Ehtesham",
      email: "kaizxark@gmail.com",
      role: "admin",
      username: "kaizxark",
    });
  });

  it("says what a pupil should type instead", async () => {
    // The shared name stands for "a pupil", so a code asked for with it
    // cannot say which pupil it is for.
    const res = await post({ identifier: "kaizxark@gmail.com" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toContain("username");
  });

  it("still serves the account that holds the name", async () => {
    // The shared name is very often the school owner's own address, and they
    // are entitled to a code for it like anybody else.
    const res = await post({ identifier: "kaizxark@gmail.com" });
    expect(res.status).toBe(200);
    expect(mail.sent[0].to).toBe("kaizxark@gmail.com");
  });
});

describe("POST /api/otp — verifying a code", () => {
  beforeEach(() => {
    store.profiles.push(STAFF_PROFILE);
  });

  it("returns a session for the right code", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    const code = mailedCode();

    const res = await post({
      email: "rajesh.menon@myschool.edu.in",
      code,
      action: "verify",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.session.access_token).toBe("session-access-token");
    expect(body.session.refresh_token).toBe("session-refresh-token");
  });

  it("spends the code so it cannot be used twice", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    const code = mailedCode();

    const first = await post({
      email: "rajesh.menon@myschool.edu.in",
      code,
      action: "verify",
    });
    expect(first.status).toBe(200);

    const second = await post({
      email: "rajesh.menon@myschool.edu.in",
      code,
      action: "verify",
    });
    expect(second.status).toBe(400);
  });

  it("says the same thing about a wrong code as about no code at all", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    const wrong = await post({
      email: "rajesh.menon@myschool.edu.in",
      code: "000000",
      action: "verify",
    });
    const wrongBody = await wrong.json();

    const none = await post({
      email: "nobody@nowhere.invalid",
      code: "000000",
      action: "verify",
    });
    const noneBody = await none.json();

    expect(wrong.status).toBe(none.status);
    expect(wrongBody).toEqual(noneBody);
  });

  it("counts a wrong guess against the code", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    const row = store.codes[0];

    await post({
      email: "rajesh.menon@myschool.edu.in",
      code: "000000",
      action: "verify",
    });
    expect(row.attempts).toBe(1);
  });

  it("stops a sweep once the attempts run out", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    const row = store.codes[0];
    row.attempts = OTP_MAX_ATTEMPTS;

    const res = await post({
      email: "rajesh.menon@myschool.edu.in",
      code: "000000",
      action: "verify",
    });
    expect(res.status).toBe(429);
  });

  it("refuses a code that has expired", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    store.codes[0].expires_at = new Date(Date.now() - 1000).toISOString();

    const res = await post({
      email: "rajesh.menon@myschool.edu.in",
      code: mailedCode(),
      action: "verify",
    });
    expect(res.status).toBe(400);
  });

  it("refuses a code that has already been spent", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    store.codes[0].consumed_at = new Date().toISOString();

    const res = await post({
      email: "rajesh.menon@myschool.edu.in",
      code: mailedCode(),
      action: "verify",
    });
    expect(res.status).toBe(400);
  });

  it("refuses a code that is not six digits", async () => {
    const res = await post({
      email: "rajesh.menon@myschool.edu.in",
      code: "123",
      action: "verify",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a code typed with spaces", async () => {
    // People read the number off a phone screen and type it in groups.
    await post({ email: "rajesh.menon@myschool.edu.in" });
    const code = mailedCode();
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;

    const res = await post({
      email: "rajesh.menon@myschool.edu.in",
      code: spaced,
      action: "verify",
    });
    expect(res.status).toBe(200);
  });

  it("tells the client whose account the session belongs to", async () => {
    await post({ email: "rajesh.menon@myschool.edu.in" });
    const res = await post({
      email: "rajesh.menon@myschool.edu.in",
      code: mailedCode(),
      action: "verify",
    });
    const body = await res.json();

    expect(body.subject.kind).toBe("staff");
    expect(body.subject.username).toBe("rajesh.menon");
    expect(body.subject.role).toBe("admin");
  });
});
