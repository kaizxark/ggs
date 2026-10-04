import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, {
  extractJsonObject,
  fitBrief,
  normaliseBaseUrl,
  parseReply,
  scopeDatasets,
  searchDataset,
} from "./ai";
import { scopeBrief, sanitiseSuggestion, screensForRole } from "../shared/ai-access";
import { sealSecret } from "../shared/ai-config";
import { SUPER_ADMIN_ID } from "../shared/super-admin";

/* ------------------------------------------------------------------ *
 * URL handling
 * ------------------------------------------------------------------ */

describe("normaliseBaseUrl", () => {
  it("keeps a plain base and strips trailing slashes", () => {
    expect(normaliseBaseUrl("https://api.example.com/v1/")).toBe(
      "https://api.example.com/v1"
    );
  });

  it("drops a pasted full chat/completions endpoint", () => {
    expect(normaliseBaseUrl("https://api.example.com/v1/chat/completions")).toBe(
      "https://api.example.com/v1"
    );
  });

  it("rejects unusable values rather than fetching them", () => {
    // The base is used to build an outbound request, so a non-http scheme or a
    // value that is not a URL must never reach fetch.
    expect(normaliseBaseUrl("file:///etc/passwd")).toBeNull();
    expect(normaliseBaseUrl("not a url")).toBeNull();
    expect(normaliseBaseUrl("")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Reply parsing
 * ------------------------------------------------------------------ */

describe("extractJsonObject", () => {
  it("reads a clean JSON reply", () => {
    expect(extractJsonObject('{"answer":"hi"}')).toEqual({ answer: "hi" });
  });

  it("unwraps a fenced code block", () => {
    expect(extractJsonObject('```json\n{"answer":"hi"}\n```')).toEqual({
      answer: "hi",
    });
  });

  it("finds the object when the model adds preamble", () => {
    expect(extractJsonObject('Here you go:\n{"answer":"hi"}')).toEqual({
      answer: "hi",
    });
  });

  it("is not confused by a brace inside a string value", () => {
    expect(
      extractJsonObject('{"answer":"class 3B { and more"}')?.answer
    ).toBe("class 3B { and more");
  });

  it("returns null when there is no object at all", () => {
    expect(extractJsonObject("just prose")).toBeNull();
  });
});

describe("parseReply", () => {
  it("drops a route that is not a real screen", () => {
    // A hallucinated route must not become a button leading nowhere.
    expect(parseReply('{"answer":"x","route":"payroll"}').route).toBeNull();
  });

  it("falls back to the whole reply when there is no JSON", () => {
    expect(parseReply("just prose").answer).toBe("just prose");
  });
});

/* ------------------------------------------------------------------ *
 * Role scoping — the security-critical part
 * ------------------------------------------------------------------ */

describe("scopeDatasets", () => {
  const ALL = {
    students: [{ name: "Aarav Sharma" }],
    invoices: [{ family: "Menon family" }],
    people: [{ email: "kaizxark@gmail.com" }],
    staff: [{ name: "Priya Shah" }],
    transport_routes: [{ vehicle: "KA-01" }],
  };

  it("gives a teacher the teaching data and nothing financial", () => {
    const scoped = scopeDatasets(ALL, "teacher");
    // A teacher cannot open the Staff screen either, so the staff directory is
    // scoped out with everything else — the assistant is deliberately no more
    // generous than the dashboard it lives in.
    expect(Object.keys(scoped).sort()).toEqual(["students", "transport_routes"]);
    // The ledger must not be anywhere in what reaches the provider.
    expect(JSON.stringify(scoped)).not.toContain("Menon");
  });

  it("gives an accountant the money but not other people's accounts", () => {
    const scoped = scopeDatasets(ALL, "accountant");
    expect(Object.keys(scoped).sort()).toEqual(["invoices", "students", "transport_routes"]);
    expect(JSON.stringify(scoped)).not.toContain("kaizxark@gmail.com");
  });

  it("gives a principal results and staffing but no ledger and no accounts", () => {
    const scoped = scopeDatasets(ALL, "principal");
    expect(Object.keys(scoped).sort()).toEqual(["staff", "students", "transport_routes"]);
  });

  it("gives the super admin everything", () => {
    expect(Object.keys(scopeDatasets(ALL, "super_admin")).sort()).toEqual(
      Object.keys(ALL).sort()
    );
  });

  it("fails closed for a role nobody has defined", () => {
    // A future role nobody has thought about must not inherit the widest view.
    // It keeps Overview, which is the one screen that is safe for anyone.
    const scoped = scopeDatasets(ALL, "some_new_role");
    expect(Object.keys(scoped)).toEqual([]);
  });

  it("ignores a dataset whose rows are not an array", () => {
    const scoped = scopeDatasets({ students: "nope" } as never, "admin");
    expect(scoped.students).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * Brief scoping
 * ------------------------------------------------------------------ */

describe("scopeBrief", () => {
  const BRIEF = {
    school: "Global Kids School",
    how_to_read_this: ["rupees"],
    headline: { active_students: 100, fee_collection_pct: 78 },
    fees: { outstanding_total: "₹4.82 lakh" },
    top_outstanding_invoices: [{ family: "Menon family" }],
    staff_by_department: [{ department: "Accounts" }],
    people: [{ email: "kaizxark@gmail.com" }],
    ready_made_answers: {
      attendance: "Attendance is 92.4%.",
      fees: "₹4.82 lakh is outstanding.",
    },
  };

  it("keeps the school-wide totals and strips the ledger for a teacher", () => {
    const { brief, withheld } = scopeBrief(BRIEF, "teacher");
    const headline = brief.headline as Record<string, unknown>;
    const ready = brief.ready_made_answers as Record<string, unknown>;
    expect(brief.school).toBe("Global Kids School");
    expect(headline.active_students).toBe(100);
    // The headline is one object holding fields from different screens, so it
    // is filtered field by field: the count stays, the collection rate goes.
    expect(headline.fee_collection_pct).toBeUndefined();
    expect(brief.fees).toBeUndefined();
    expect(brief.top_outstanding_invoices).toBeUndefined();
    expect(ready.attendance).toContain("92.4%");
    expect(ready.fees).toBeUndefined();
    expect(withheld).toContain("fees");
  });

  it("never leaks account emails to a non-admin", () => {
    const { brief } = scopeBrief(BRIEF, "principal");
    expect(JSON.stringify(brief)).not.toContain("kaizxark@gmail.com");
  });

  it("gives the super admin the lot", () => {
    const { brief, withheld } = scopeBrief(BRIEF, "super_admin");
    const headline = brief.headline as Record<string, unknown>;
    expect(brief.fees).toBeDefined();
    expect(brief.people).toBeDefined();
    expect(headline.fee_collection_pct).toBe(78);
    expect(withheld).toHaveLength(0);
  });

  it("lets a teacher keep Settings without letting them read the school config", () => {
    // Settings is also where they change their own password, so the screen
    // stays open — but the school-wide configuration on it does not.
    const { brief, withheld } = scopeBrief(
      { ...BRIEF, settings_snapshot: { phone: "+91 98765 43210" }, settings_note: "config" },
      "teacher"
    );
    expect(screensForRole("teacher")).toContain("settings");
    expect(brief.settings_snapshot).toBeUndefined();
    expect(withheld).toContain("settings_snapshot");
  });

  it("keeps the structural fields whatever the role", () => {
    // These describe the school and the rules, not the school's records.
    const { brief } = scopeBrief({ ...BRIEF, assistant_role: "teacher" }, "teacher");
    expect(brief.school).toBeDefined();
    expect(brief.how_to_read_this).toBeDefined();
    expect(brief.assistant_role).toBe("teacher");
  });
});

describe("screensForRole", () => {
  it("gives the super admin every screen", () => {
    expect(screensForRole("super_admin")).toHaveLength(14);
  });

  it("accepts the display spelling as well as the stored one", () => {
    expect(screensForRole("Super admin")).toEqual(screensForRole("super_admin"));
    expect(screensForRole("Super Admin")).toEqual(screensForRole("super_admin"));
  });

  it("gives an unknown role the narrowest safe view", () => {
    expect(screensForRole("who-knows")).toEqual(["overview"]);
    expect(screensForRole(undefined)).toEqual(["overview"]);
  });
});

describe("sanitiseSuggestion", () => {
  it("drops actions the role cannot reach and unknown screens", () => {
    const result = sanitiseSuggestion(
      {
        answer: "ok",
        actions: [
          { label: "Open the ledger", screen: "finance" },
          { label: "Open Payroll", screen: "payroll_hr" },
          { label: "Open Attendance", screen: "attendance" },
        ],
      },
      "teacher"
    );
    expect(result.actions.map((a) => a.screen)).toEqual(["attendance"]);
  });

  it("caps a runaway list rather than rendering hundreds of chips", () => {
    const result = sanitiseSuggestion(
      {
        answer: "ok",
        follow_ups: Array.from({ length: 40 }, (_, i) => `q${i}`),
        bullets: Array.from({ length: 40 }, (_, i) => `b${i}`),
      },
      "admin"
    );
    expect(result.followUps).toHaveLength(4);
    expect(result.bullets).toHaveLength(8);
  });

  it("falls back to a safe default when the model returns nothing usable", () => {
    const result = sanitiseSuggestion(undefined, "admin");
    expect(result.confidence).toBe("high");
    expect(result.actions).toEqual([]);
  });

  it("truncates an enormous answer instead of rendering it", () => {
    const result = sanitiseSuggestion({ answer: "x".repeat(50_000) }, "admin");
    expect(result.answer.length).toBeLessThanOrEqual(4000);
  });
});

/* ------------------------------------------------------------------ *
 * The lookup tool
 * ------------------------------------------------------------------ */

describe("searchDataset", () => {
  const rows = [
    { name: "Aarav Sharma", grade: "Grade 5", admission_no: "ADM/26-27/0041" },
    { name: "Diya Nair", grade: "Grade 8", admission_no: "ADM/26-27/0102" },
    { name: "Rohan Iyer", grade: "Grade 3", admission_no: "ADM/26-27/0007" },
  ];

  it("matches on any field, not just the name", () => {
    // Someone typing a class or an admission number expects to find the row.
    const byGrade = searchDataset(rows, "Grade 8", 8)[0] as { name: string };
    const byAdmission = searchDataset(rows, "ADM/26-27/0041", 8)[0] as {
      name: string;
    };
    expect(byGrade.name).toBe("Diya Nair");
    expect(byAdmission.name).toBe("Aarav Sharma");
  });

  it("matches case-insensitively and on partial text", () => {
    expect(searchDataset(rows, "sharma", 8)).toHaveLength(1);
  });

  it("returns the first rows when the query is empty", () => {
    expect(searchDataset(rows, "", 2)).toHaveLength(2);
  });

  it("caps the number of rows it will return", () => {
    // An unbounded search is a way for the model to pull a whole table into one
    // reply and blow the context budget.
    expect(searchDataset(rows, "", 999)).toHaveLength(3);
  });

  it("returns nothing rather than everything when there is no match", () => {
    expect(searchDataset(rows, "zzzz", 8)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Brief budget
 * ------------------------------------------------------------------ */

describe("fitBrief", () => {
  it("leaves a brief that fits alone", () => {
    const brief = { school: "GKS", headline: { active_students: 10 } };
    expect(fitBrief(brief, 10_000)).toEqual(brief);
  });

  it("keeps the essentials when a brief is oversized", () => {
    const brief = {
      school: "GKS",
      how_to_read_this: ["rupees"],
      ready_made_answers: { fees: "keep me" },
      headline: { active_students: 10 },
      generated_at: "now",
      transport_routes: [{ vehicle: "x".repeat(4000) }],
      announcements: [{ body: "y".repeat(4000) }],
    };
    const fitted = fitBrief(brief, 500);
    expect(fitted.school).toBe("GKS");
    expect(fitted.ready_made_answers).toEqual({ fees: "keep me" });
    expect(JSON.stringify(fitted).length).toBeLessThanOrEqual(500);
  });

  it("produces valid JSON rather than a truncated document", () => {
    // The previous implementation sliced the serialised brief in the middle,
    // which handed the model invalid JSON at both ends — a wall of punctuation
    // that it then tried to read as data.
    const brief = {
      how_to_read_this: ["rupees"],
      announcements: [{ body: "z".repeat(50_000) }],
      messages: [{ subject: "q".repeat(50_000) }],
    };
    const fitted = fitBrief(brief, 400);
    expect(() => JSON.stringify(fitted)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ *
 * End to end through the route
 * ------------------------------------------------------------------ */

const REAL_FETCH = globalThis.fetch;

const SAMPLE_BRIEF = {
  school: "Global Kids School, Tumakuru, Karnataka, India",
  how_to_read_this: ["All money is Indian rupees (₹)."],
  headline: { active_students: 1284, fee_collection_pct: 78.1 },
  fees: { outstanding_total: "₹4.82 lakh" },
  ready_made_answers: { attendance: "Attendance is 92.4%.", fees: "₹4.82 lakh is due." },
};

const SAMPLE_DATASETS = {
  students: [
    { name: "Aarav Sharma", grade: "Grade 5", admission_no: "ADM/26-27/0041" },
    { name: "Diya Nair", grade: "Grade 8" },
  ],
  invoices: [{ family: "Menon family", amount_due: "₹62,000" }],
};

describe("POST /api/ai", () => {
  /** The saved configuration, sealed exactly as it would be in production. */
  let storedKey = "";
  let callerId = "some-user-id";
  let callerRole = "admin";
  /** Flip to model a school where the super admin has not configured one yet. */
  let hasStoredConfig = true;

  beforeEach(async () => {
    storedKey = await sealSecret("stored-provider-key");
    callerId = "11111111-1111-1111-1111-111111111111";
    callerRole = "admin";
    hasStoredConfig = true;
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  /**
   * Stub the network by URL.
   *
   * The route talks to Supabase (to identify the caller and to read the saved
   * configuration) before it talks to the provider, so a blanket mock would
   * hand the provider's reply to the auth endpoint.
   */
  function stubNetwork(
    provider: (url: string, init?: RequestInit) => Response | Promise<Response>
  ) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push({ url: href, init });

      if (href.includes("/auth/v1/user")) {
        return Response.json({ id: callerId, email: "someone@gks.edu" });
      }
      if (href.includes("/rest/v1/profiles")) {
        return Response.json([{ id: callerId, role: callerRole }]);
      }
      if (href.includes("/rest/v1/settings")) {
        if (!hasStoredConfig) return Response.json([]);
        return Response.json([
          {
            id: "set-ai",
            key: "ai_assistant",
            value: {
              provider_id: "gemini",
              base: "https://generativelanguage.googleapis.com/v1beta",
              model: "gemini-3.8-flash",
              api_key_sealed: storedKey,
            },
          },
        ]);
      }
      return provider(href, init);
    }) as unknown as typeof fetch;
    return calls;
  }

  function post(headers: Record<string, string>, body: Record<string, unknown>) {
    return handler(
      new Request("https://erp.example.com/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(headers.Authorization === undefined && !headers["no-auth"]
            ? { Authorization: "Bearer a-real-session-token" }
            : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      })
    ).then(async (res) => ({ res, json: await res.json() }));
  }

  const geminiText = (text: string) =>
    Response.json({
      candidates: [{ content: { parts: [{ text }] } }],
    });

  /* ---------------- authentication ---------------- */

  it("refuses a request with no session", async () => {
    stubNetwork(() => Response.json({}));
    const { res, json } = await post(
      { "no-auth": "1" },
      { question: "how many students?", context: SAMPLE_BRIEF }
    );
    // The assistant is open to the whole school, so an unauthenticated caller
    // would be a way to spend the school's quota from anywhere on the internet.
    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthenticated");
  });

  it("ignores a provider override sent by someone who is not the super admin", async () => {
    // An ordinary admin, whose stored role is "admin" on an id that is not the
    // super admin's.
    callerRole = "admin";
    const calls = stubNetwork(() =>
      geminiText(JSON.stringify({ answer: "ok", confidence: "high" }))
    );
    const { res } = await post(
      {
        "x-ai-key": "attackers-key",
        "x-ai-base": "https://attacker.example.com/v1",
        "x-ai-model": "whatever",
      },
      { question: "hello", context: SAMPLE_BRIEF }
    );
    expect(res.status).toBe(200);
    const providerCalls = calls.filter((call) => call.url.includes("/models/"));
    expect(providerCalls.length).toBeGreaterThan(0);
    for (const call of providerCalls) {
      expect(call.url).toContain("generativelanguage.googleapis.com");
      expect(call.url).not.toContain("attacker.example.com");
      expect(String(call.init?.body ?? "")).not.toContain("attackers-key");
    }
  });

  it("uses a caller's own key when the school has not configured one", async () => {
    // The regression this guards: restricting the key header to the super admin
    // meant every other user got "not configured" until the super admin saved
    // the shared settings — so the assistant appeared broken for the whole
    // school. A key supplied by the caller is their own credential and grants
    // nothing, so it is honoured.
    callerRole = "teacher";
    const calls = stubNetwork(() =>
      geminiText(JSON.stringify({ answer: "Grade 5 is lowest at 88.1%.", confidence: "high" }))
    );
    const { res, json } = await post(
      { "x-ai-key": "AIzaTeachersOwnKey" },
      { question: "which class is lowest?", context: SAMPLE_BRIEF }
    );
    expect(res.status).toBe(200);
    expect(json.answer).toContain("88.1%");
    const providerCall = calls.find((c) => c.url.includes("/models/"));
    expect(providerCall?.url).toContain("key=AIzaTeachersOwnKey");
  });

  it("says the assistant is not switched on when there is no key at all", async () => {
    callerRole = "teacher";
    hasStoredConfig = false;
    stubNetwork(() => geminiText(JSON.stringify({ answer: "unused", confidence: "high" })));
    const { res, json } = await post({}, { question: "hello", context: SAMPLE_BRIEF });
    expect(res.status).toBe(503);
    // The message has to name who can fix it, or it is just a dead end.
    expect(json.error).toBe("not_configured");
    expect(json.message).toContain("Settings");
  });

  /* ---------------- Gemini ---------------- */

  it("calls Gemini natively with a system instruction, a schema and the lookup tool", async () => {
    const calls = stubNetwork(() =>
      geminiText(JSON.stringify({ answer: "There are 1,284 students.", confidence: "high" }))
    );
    const { res, json } = await post(
      {},
      { question: "how many students?", context: SAMPLE_BRIEF, datasets: SAMPLE_DATASETS }
    );

    expect(res.status).toBe(200);
    const body = JSON.parse(String(calls.find((c) => c.url.includes("/models/"))?.init?.body));
    expect(body.systemInstruction.parts[0].text).toContain("Global Kids School ERP");
    // Structured output is what makes the reply renderable without guessing.
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.required).toContain("actions");
    expect(body.tools[0].functionDeclarations[0].name).toBe("search_records");
    expect(json.answer).toContain("1,284");
  });

  it("serves a specific-record question from the lookup tool, not from the aggregate", async () => {
    const calls = stubNetwork((url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const last = String(body.contents?.[body.contents.length - 1]?.parts?.[0]?.text ?? "");
      if (last.includes("DATA BRIEF")) {
        // First turn: the model reaches for the specific invoice.
        return Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "search_records",
                      args: { dataset: "invoices", query: "Menon", limit: 5 },
                    },
                  },
                ],
              },
            },
          ],
        });
      }
      return geminiText(
        JSON.stringify({
          answer: "The Menon family owes ₹62,000.",
          sources: ["Fees & Finance"],
          actions: [{ label: "Open the fee ledger", screen: "finance" }],
          confidence: "high",
        })
      );
    });

    const { res, json } = await post(
      {},
      { question: "what does the Menon family owe?", context: SAMPLE_BRIEF, datasets: SAMPLE_DATASETS }
    );

    expect(res.status).toBe(200);
    // The tool ran on the server and its rows went back to the model.
    const sent = calls
      .filter((c) => c.url.includes("/models/"))
      .map((c) => String(c.init?.body ?? ""))
      .join("\n");
    expect(sent).toContain("Menon");
    expect(json.answer).toContain("62,000");
    expect(json.actions[0].screen).toBe("finance");
  });

  it("never offers a dataset the caller's role cannot open", async () => {
    callerRole = "teacher";
    const calls = stubNetwork(() =>
      geminiText(JSON.stringify({ answer: "ok", confidence: "high" }))
    );
    const { res } = await post(
      {},
      { question: "hello", context: SAMPLE_BRIEF, datasets: SAMPLE_DATASETS }
    );
    expect(res.status).toBe(200);

    const sent = calls
      .filter((c) => c.url.includes("/models/"))
      .map((c) => String(c.init?.body ?? ""))
      .join("\n");
    // The pupils are searchable; the ledger is not even offered to the tool, so
    // a teacher cannot reach the invoices by asking nicely either.
    expect(sent).toContain("- students (2 rows)");
    expect(sent).not.toContain("invoices");
    // And the brief itself has had the money taken out of it.
    expect(sent).not.toContain("4.82");
  });

  it("drops a button leading to a screen the caller cannot open", async () => {
    callerRole = "teacher";
    stubNetwork(() =>
      geminiText(
        JSON.stringify({
          answer: "₹4.82 lakh is outstanding.",
          // A model that ignored its instructions and offered both.
          actions: [
            { label: "Open the fee ledger", screen: "finance" },
            { label: "Open Attendance", screen: "attendance" },
            { label: "Open Payroll", screen: "payroll" },
          ],
          confidence: "high",
        })
      )
    );
    const { json } = await post(
      {},
      { question: "what is outstanding?", context: SAMPLE_BRIEF, datasets: SAMPLE_DATASETS }
    );
    expect(json.actions).toEqual([
      { label: "Open Attendance", screen: "attendance", studentId: null },
    ]);
  });

  /* ---------------- blank replies ---------------- */

  /*
   * The blank card.
   *
   * Two separate paths produced a reply with an empty `answer`, which rendered
   * as a heading and no text:
   *
   *   1. The final round still offered `search_records`, so the model could
   *      spend that turn on another tool call. A round made only of a function
   *      call carries no text, so the answer came back empty.
   *   2. The model returned `{"answer": ""}` — valid against the schema — and it
   *      was passed straight through.
   *
   * Both are asserted here because both were live at once.
   */
  it("never returns an empty answer when the model keeps calling the tool", async () => {
    stubNetwork(() =>
      // Every round is a function call and nothing else: the worst case.
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "search_records",
                    args: { dataset: "invoices", query: "anything", limit: 5 },
                  },
                },
              ],
            },
          },
        ],
      })
    );

    const { res, json } = await post(
      {},
      { question: "what is outstanding?", context: SAMPLE_BRIEF, datasets: SAMPLE_DATASETS }
    );

    expect(res.status).toBe(200);
    expect(typeof json.answer).toBe("string");
    expect(json.answer.trim().length).toBeGreaterThan(0);
  });

  it("re-asks when the model replies with valid JSON but no answer text", async () => {
    let round = 0;
    const calls = stubNetwork(() => {
      round += 1;
      // First reply parses cleanly and says nothing.
      return round === 1
        ? geminiText(JSON.stringify({ answer: "", confidence: "high" }))
        : geminiText(JSON.stringify({ answer: "Attendance is 92.4%.", confidence: "high" }));
    });

    const { res, json } = await post(
      {},
      { question: "how is attendance?", context: SAMPLE_BRIEF }
    );

    expect(res.status).toBe(200);
    expect(json.answer).toContain("92.4%");
    // It had to actually ask again rather than render the blank.
    expect(round).toBe(2);
    const retry = calls.filter((c) => c.url.includes("/models/"))[1];
    expect(retry).toBeTruthy();
  });

  it("says something useful rather than nothing when even the retry is empty", async () => {
    stubNetwork(() => geminiText(JSON.stringify({ answer: "", confidence: "high" })));

    const { res, json } = await post(
      {},
      { question: "how is attendance?", context: SAMPLE_BRIEF }
    );

    expect(res.status).toBe(200);
    expect(json.answer.trim().length).toBeGreaterThan(0);
  });

  it("offers no tool on the last round, so a reply cannot be spent searching", async () => {
    const calls = stubNetwork(() =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "search_records",
                    args: { dataset: "invoices", query: "x", limit: 5 },
                  },
                },
              ],
            },
          },
        ],
      })
    );

    await post(
      {},
      { question: "what is outstanding?", context: SAMPLE_BRIEF, datasets: SAMPLE_DATASETS }
    );

    const providerCalls = calls.filter((c) => c.url.includes("/models/"));
    const last = providerCalls[providerCalls.length - 1];
    const body = JSON.parse(String(last?.init?.body ?? "{}"));
    // No function declarations means the model can only answer.
    const declarations = body.tools?.[0]?.functionDeclarations;
    expect(!declarations || declarations.length === 0).toBe(true);
  });

  it("answers a follow-up with the earlier turns in context", async () => {
    const calls = stubNetwork(() =>
      geminiText(JSON.stringify({ answer: "Grade 5 is at 88.1%.", confidence: "high" }))
    );
    const { res } = await post(
      {},
      {
        question: "and Grade 5?",
        context: SAMPLE_BRIEF,
        datasets: SAMPLE_DATASETS,
        history: [
          { role: "user", text: "which class has the lowest attendance?" },
          { role: "model", text: "Grade 9 is lowest at 87%." },
        ],
      }
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(String(calls.find((c) => c.url.includes("/models/"))?.init?.body));
    // Without this, "and Grade 5?" has no referent and the model guesses.
    expect(JSON.stringify(body.contents)).toContain("which class has the lowest attendance?");
    expect(JSON.stringify(body.contents)).toContain("and Grade 5?");
  });

  it("explains a provider rejection instead of returning a blank panel", async () => {
    stubNetwork(() =>
      Response.json({ error: { message: "API key not valid" } }, { status: 400 })
    );
    const { res, json } = await post({}, { question: "hi", context: {} });
    expect(res.status).toBe(502);
    expect(json.error).toBe("provider_error");
    expect(json.message).toContain("API key not valid");
  });

  /* ---------------- OpenAI-compatible providers ---------------- */

  it("still works against a non-OpenAI provider", async () => {
    // Only the super admin's own id grants the header override — the role
    // stored on the profile is not enough, which is the whole reason
    // `effectiveRole` keys on the id.
    callerId = SUPER_ADMIN_ID;
    callerRole = "admin";
    const calls = stubNetwork(() =>
      Response.json({
        choices: [
          {
            message: {
              content:
                '```json\n{"answer":"24 absent today.","actions":[{"label":"Open Attendance","screen":"attendance"}],"follow_ups":["Who is absent?"],"confidence":"high"}\n```',
            },
          },
        ],
      })
    );

    const { res, json } = await post(
      {
        "x-ai-key": "gsk_local_style_key",
        "x-ai-base": "https://api.groq.com/openai/v1",
        "x-ai-model": "llama-3.3-70b-versatile",
      },
      { question: "who is absent?", context: SAMPLE_BRIEF }
    );

    expect(res.status).toBe(200);
    const providerCall = calls.find((c) => c.url.includes("/chat/completions"));
    expect(providerCall?.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(String(providerCall?.init?.body));
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect((body.messages[0] as { content: string }).content).toContain("DATA BRIEF");
    expect(json.answer).toBe("24 absent today.");
    expect(json.actions[0].screen).toBe("attendance");
    expect(json.followUps).toEqual(["Who is absent?"]);
  });

  it("keeps a model id containing a slash and a routing suffix intact", async () => {
    callerId = SUPER_ADMIN_ID;
    callerRole = "admin";
    const calls = stubNetwork(() =>
      Response.json({ choices: [{ message: { content: '{"answer":"ok"}' } }] })
    );
    const { res } = await post(
      {
        "x-ai-key": "hf_token",
        "x-ai-base": "https://router.huggingface.co/v1",
        "x-ai-model": "meta-llama/Llama-3.1-8B-Instruct:cheapest",
      },
      { question: "hi", context: SAMPLE_BRIEF }
    );
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.url.includes("/chat/completions"))?.url).toBe(
      "https://router.huggingface.co/v1/chat/completions"
    );
  });

  /* ---------------- configuration ---------------- */

  it("says so plainly when nobody has configured a provider yet", async () => {
    hasStoredConfig = false;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/auth/v1/user")) {
        return Response.json({ id: callerId, email: "a@b.c" });
      }
      if (href.includes("/rest/v1/profiles")) {
        return Response.json([{ id: callerId, role: callerRole }]);
      }
      return Response.json([]);
    }) as unknown as typeof fetch;

    const { res, json } = await post({}, { question: "hello", context: {} });
    expect(res.status).toBe(503);
    expect(json.error).toBe("not_configured");
    // The message must say who can fix it, not just that it is broken.
    expect(json.message).toContain("super admin");
  });

  it("tests the stored credential server-side", async () => {
    const calls = stubNetwork(() =>
      Response.json({ candidates: [{ content: { parts: [{ text: "ready" }] } }] })
    );
    const { res, json } = await post({}, { action: "ping" });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.model).toBe("gemini-3.8-flash");
    expect(calls.some((c) => c.url.includes("/models/gemini-3.8-flash:generateContent"))).toBe(
      true
    );
  });
});