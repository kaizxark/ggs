import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Recovery is the way back in when a password is forgotten, so the two things
 * that matter are tested here: the message goes to the address that can
 * actually receive it, and the reply never tells an anonymous caller whether
 * an account exists.
 */

const mail = vi.hoisted(() => {
  const sent: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }[] = [];
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

import { POST } from "./recover";

const realFetch = globalThis.fetch;

interface Store {
  profiles: Record<string, unknown>[];
  students: Record<string, unknown>[];
  authUsers: { id: string; email: string }[];
}

let store: Store;

function filterValue(url: string, column: string): string | null {
  const match = new RegExp(`(?:[?&])${column}=eq\\.([^&]+)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

function stubNetwork() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/rest/v1/profiles")) {
      const byEmail = filterValue(url, "email");
      const byUsername = filterValue(url, "username");
      const rows = store.profiles.filter(row => {
        if (byEmail) {
          return String(row.email ?? "").toLowerCase() === byEmail.toLowerCase();
        }
        if (byUsername) {
          return String(row.username ?? "") === byUsername;
        }
        return true;
      });
      return Response.json(rows);
    }

    if (url.includes("/rest/v1/students")) {
      const byId = filterValue(url, "id");
      return Response.json(
        store.students.filter(row => !byId || String(row.id) === byId),
      );
    }

    if (url.includes("/auth/v1/admin/users")) {
      return Response.json({ users: store.authUsers });
    }

    if (url.includes("/auth/v1/admin/generate_link")) {
      return Response.json({
        action_link:
          "https://project.supabase.co/auth/v1/verify?token=recovery-token&type=recovery",
      });
    }

    return Response.json([]);
  }) as typeof fetch;
}

let clientNumber = 0;

function post(body: unknown) {
  clientNumber += 1;
  return POST(
    new Request("https://erp.test/api/recover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `198.51.100.${clientNumber}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  store = { profiles: [], students: [], authUsers: [] };
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

describe("POST /api/recover", () => {
  it("answers an unknown username exactly as it answers a known one", async () => {
    // The reply has to be identical, or the form is a way of listing who has
    // an account in the school.
    store.profiles.push({
      id: "profile-1",
      email: "rajesh.menon@myschool.edu.in",
      username: "rajesh.menon",
      full_name: "Rajesh Menon",
    });

    const known = await post({ username: "rajesh.menon" });
    const knownBody = await known.json();
    const unknown = await post({ username: "nosuchuser" });
    const unknownBody = await unknown.json();

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(knownBody).toEqual(unknownBody);
  });

  it("sends the message to the account's address, not to the username", async () => {
    // The bug this pins down: the typed value was mailed. A username is not
    // an address, so the relay dropped the message and nobody was ever told.
    store.profiles.push({
      id: "profile-1",
      email: "rajesh.menon@myschool.edu.in",
      username: "rajesh.menon",
      full_name: "Rajesh Menon",
    });

    await post({ username: "rajesh.menon" });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("rajesh.menon@myschool.edu.in");
  });

  it("sends the link to the account's own address when one is typed in full", async () => {
    store.profiles.push({
      id: "profile-1",
      email: "rajesh.menon@myschool.edu.in",
      username: "rajesh.menon",
      full_name: "Rajesh Menon",
    });

    await post({ username: "rajesh.menon@myschool.edu.in" });
    expect(mail.sent[0].to).toBe("rajesh.menon@myschool.edu.in");
  });

  it("emails a link that carries the token and lands on the reset page", async () => {
    store.profiles.push({
      id: "profile-1",
      email: "rajesh.menon@myschool.edu.in",
      username: "rajesh.menon",
      full_name: "Rajesh Menon",
    });

    await post({ username: "rajesh.menon" });
    const text = mail.sent[0].text;

    // Without the token the link opens a page that never carries a session,
    // and the person always lands on the expired screen.
    expect(text).toContain("token=recovery-token");
    expect(text).toContain("type=recovery");
    // The redirect is percent-encoded inside the query string.
    expect(text).toContain("%2Freset-password");
  });

  it("builds the redirect from the request's own host", async () => {
    store.profiles.push({
      id: "profile-1",
      email: "rajesh.menon@myschool.edu.in",
      username: "rajesh.menon",
      full_name: "Rajesh Menon",
    });

    clientNumber += 1;
    await POST(
      new Request("https://erp.test/api/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `198.51.100.${clientNumber}`,
          "x-forwarded-host": "erp-abc123.vercel.app",
          "x-forwarded-proto": "https",
        },
        body: JSON.stringify({ username: "rajesh.menon" }),
      }),
    );

    expect(mail.sent[0].text).toContain(
      "redirect_to=https%3A%2F%2Ferp-abc123.vercel.app%2Freset-password",
    );
  });

  it("refuses a username containing filter syntax", async () => {
    const res = await post({ username: "x,or(1=1" });
    expect(res.status).toBe(400);
    expect(mail.sent).toHaveLength(0);
  });

  it("sends the message to the family when a pupil has no address of their own", async () => {
    // A placeholder address cannot receive mail, so a pupil who has never been
    // given a real one would be locked out for good.
    store.profiles.push({
      id: "profile-2",
      email: "student-priya-3b@gks.invalid",
      username: "priya.menon",
      full_name: "Priya Menon",
      student_id: "student-1",
    });
    store.students.push({
      id: "student-1",
      first_name: "Priya",
      last_name: "Menon",
      guardian_email: "parent@example.com",
      guardian_name: "Anita Menon",
    });

    await post({ username: "priya.menon" });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("parent@example.com");
    // The message has to say whose account it opens: a family with more than
    // one child cannot tell which one this is for otherwise.
    expect(mail.sent[0].text).toContain("Priya Menon");
  });

  it("sends the message to the family when a pupil's address is a school mailbox", async () => {
    /*
     * A gks.edu.in address is issued to a pupil as an identifier, not an inbox
     * the family can open. Mailing the reset link there was the same dead end
     * as the inert placeholder, and the sender reported success either way.
     */
    store.profiles.push({
      id: "profile-3",
      email: "priya.menon@gks.edu.in",
      username: "priya.menon",
      full_name: "Priya Menon",
      student_id: "student-3",
    });
    store.students.push({
      id: "student-3",
      first_name: "Priya",
      last_name: "Menon",
      guardian_email: "parent@example.com",
      guardian_name: "Anita Menon",
    });

    await post({ username: "priya.menon" });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("parent@example.com");
    expect(mail.sent[0].text).toContain("Priya Menon");
  });

  it("keeps a school mailbox for a member of staff, who can read it", async () => {
    // Only a pupil's school address is redirected. A teacher's own mailbox is
    // theirs, and sending their reset link to a child's guardian would be
    // both useless and a leak.
    store.profiles.push({
      id: "profile-4",
      email: "meera.iyer@gks.edu.in",
      username: "meera.iyer",
      full_name: "Meera Iyer",
    });

    await post({ username: "meera.iyer" });

    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("meera.iyer@gks.edu.in");
  });

  it("sends nothing when there is no family address on file either", async () => {
    store.profiles.push({
      id: "profile-2",
      email: "student-priya-3b@gks.invalid",
      username: "priya.menon",
      full_name: "Priya Menon",
      student_id: "student-1",
    });
    store.students.push({
      id: "student-1",
      first_name: "Priya",
      last_name: "Menon",
      guardian_email: "",
      guardian_name: "",
    });

    const res = await post({ username: "priya.menon" });
    expect(res.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
  });

  it("keeps the same reply when the mail cannot be delivered", async () => {
    store.profiles.push({
      id: "profile-1",
      email: "rajesh.menon@myschool.edu.in",
      username: "rajesh.menon",
      full_name: "Rajesh Menon",
    });
    mail.fail.value = true;

    const res = await post({ username: "rajesh.menon" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toContain("on its way");
  });
});
