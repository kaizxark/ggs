#!/usr/bin/env node
/**
 * Seeds the "My School" organisation (2f6cbae9-ed79-45e3-819c-a8c80eee7a0f)
 * in the live Supabase ERP with a realistic fake dataset.
 *
 * Design goal: the data must look like it came out of a real school. That means
 * the numbers have to be *generated the way real numbers are produced*, not
 * drawn independently at random:
 *
 *   - 100 students live in 78 households. Siblings share a surname, a house
 *     address and one guardian login, and receive a sibling fee discount.
 *   - Each student has a latent academic ability plus a STEM/humanities tilt
 *     and a per-subject affinity, so a student who is strong in Mathematics is
 *     normally also strong in Science. Exams have their own difficulty. The
 *     resulting grade curve is bell-shaped, not uniform.
 *   - Attendance is generated per student against their own attendance
 *     propensity, with multi-day illness streaks, a Monday dip and genuine
 *     school holidays removed from the calendar.
 *   - Fees are grade-based, discounted for siblings and concessions, billed in
 *     two terms, and paid by families with a consistent payment reliability.
 *   - Notifications reference the actual invoices that are actually overdue.
 *
 * Usage:
 *   node scripts/seed-erp.mjs          # refuses if students already exist
 *   FORCE=1 node scripts/seed-erp.mjs  # wipes the org first, then reseeds
 *
 * Every seeded account gets the password in SEED_PASSWORD (email pre-confirmed).
 */

import crypto from "node:crypto";

// ------------------------------------------------------------------ config --
const SUPABASE_URL = "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!SERVICE_KEY) {
  console.error(
    "SUPABASE_SERVICE_KEY is not set. Export it before running this script; " +
      "a service key is never kept in the repository."
  );
  process.exit(1);
}
const ORG_ID = "2f6cbae9-ed79-45e3-819c-a8c80eee7a0f"; // "My School"
const ADMIN_ID = "60ff6003-c0a4-438f-85df-2048b0e7b6c8"; // kaizxark@gmail.com
// No credential is baked into the repository. Set SEED_PASSWORD in the
// environment when running this against a project that needs auth users.
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "";

// The two profiles that existed before seeding and must never be touched.
const KEEP_PROFILE_IDS = new Set([
  ADMIN_ID,
  "95655bc0-e7af-41cf-99a3-2962bc2e15cb", // sincejuly7th@gmail.com
]);
// The three organisations that existed before seeding.
const KEEP_ORG_IDS = new Set([
  ORG_ID, // My School
  "6a162e09-d2db-4638-b1b4-1ea295b0faf7", // Ssit
  "498d056e-a524-491a-901c-bbe09495eef7", // SSIT
]);

// ----------------------------------------------------------------- helpers --
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function req(method, path, { body, prefer } = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    method,
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} -> ${res.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }
  return data;
}

async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await req("POST", `/rest/v1/${table}`, {
      body: chunk,
      prefer: "return=minimal",
    });
  }
  console.log(`  + ${table}: ${rows.length} rows`);
}

// Upsert (merge on PK conflict). The auth trigger auto-creates a profile
// for every new user, so profiles must be merged, not inserted.
async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await req("POST", `/rest/v1/${table}`, {
      body: chunk,
      prefer: "return=minimal, resolution=merge-duplicates",
    });
  }
  console.log(`  ~ ${table}: ${rows.length} rows (upserted)`);
}

// Delete rows in batches so `id=in.(...)` URLs stay short.
async function deleteInBatches(table, key, ids) {
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    await req("DELETE", `/rest/v1/${table}?${key}=in.(${chunk.join(",")})`, {
      prefer: "return=minimal",
    });
  }
}

async function countOf(table, filter = "") {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`,
    { headers: { ...headers, Prefer: "count=exact" } }
  );
  const range = res.headers.get("content-range");
  return range ? Number(range.split("/").pop()) : 0;
}

// ---------------------------------------------------------------- random --
// One deterministic stream so a given seed always reproduces the same school.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261002);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p) => rand() < p;
const pad = (n, w) => String(n).padStart(w, "0");
const uuid = () => crypto.randomUUID();
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Box–Muller. Real exam scores and attendance rates are bell-shaped, so the
// generator needs a normal deviate — uniform noise is the single biggest
// reason mock data looks fake.
function gauss(mean = 0, sd = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// pick from [[value, weight], ...]
function weighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

const ts = (date, h = 10, m = 0) =>
  `${date}T${pad(h, 2)}:${pad(m, 2)}:00+05:30`;

// ------------------------------------------------------------------ dates --
const DAY = 86400000;
// Accepts a Date or a timestamp, so it can be used with either.
const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const addDays = (isoDate, n) => iso(Date.parse(isoDate + "T00:00:00Z") + n * DAY);
const dow = (isoDate) => new Date(isoDate + "T00:00:00Z").getUTCDay();
const isWeekend = (isoDate) => dow(isoDate) === 0 || dow(isoDate) === 6;

// Karnataka / central public holidays in the attendance window. Two are
// independently confirmed (Ganesh Chaturthi 14 Sep, Gandhi Jayanti 2 Oct);
// the rest follow the standard Karnataka school holiday list. Adjust here if
// the school's calendar differs.
const HOLIDAYS = new Set([
  "2026-04-03", // Mahavir Jayanti
  "2026-04-14", // Dr. B. R. Ambedkar Jayanti
  "2026-05-01", // May Day
  "2026-06-26", // Bakri Id
  "2026-08-15", // Independence Day
  "2026-08-26", // Id-e-Milad
  "2026-09-14", // Ganesh Chaturthi
  "2026-09-25", // Anant Chaturdashi / Ganesh Visarjan
  "2026-10-02", // Gandhi Jayanti
]);

const TERM_START = "2026-04-06";
const TODAY = "2026-10-02"; // the app's "today" — nothing may be dated later

function schoolDays(fromISO, toISO) {
  const days = [];
  let cur = fromISO;
  while (cur <= toISO) {
    if (!isWeekend(cur) && !HOLIDAYS.has(cur)) days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

// ------------------------------------------------------------------ names --
// Weighted so the roll looks like a Karnataka school rather than a pan-Indian
// mix. "Father's name as surname" (Thammaiah, Siddaiah, Rajanna…) is very
// common in this region and is included deliberately.
const SURNAMES = [
  // Kannada region — dominant
  ["Gowda", 13], ["Reddy", 8], ["Shetty", 6], ["Hegde", 5], ["Nayak", 4],
  ["Kulkarni", 4], ["Patil", 4], ["Raju", 3], ["Naidu", 3], ["Swamy", 3],
  ["Ranganna", 2.5], ["Thammaiah", 2.5], ["Siddaiah", 2.5], ["Thimmanna", 2],
  ["Mallappa", 2], ["Krishnappa", 2], ["Chennappa", 2], ["Lokesh", 1.5],
  ["Urs", 1.5], ["Prasad", 2], ["Shastri", 1.5], ["Acharya", 1.5],
  // other South Indian
  ["Iyer", 3], ["Nair", 3], ["Menon", 2.5], ["Rao", 2.5], ["Murthy", 2],
  ["Pillai", 1.5], ["Iyengar", 1.5], ["Krishnan", 1.5], ["Venkatesh", 1.5],
  ["Joshi", 2], ["Deshpande", 2], ["Bhat", 1.5], ["Kamath", 1],
  // rest of India / other
  ["Singh", 2.5], ["Sharma", 2], ["Verma", 1.5], ["Gupta", 1.5], ["Patel", 1.5],
  ["Chauhan", 1], ["Yadav", 1], ["Das", 1], ["Mishra", 1], ["Pandey", 0.8],
  ["Khan", 1.5], ["Ali", 1.2], ["Baig", 0.6], ["Siddiqui", 0.5],
];
const SURNAME_LIST = SURNAMES.map(([n]) => n);
const surnamePool = () => weighted(SURNAMES);

const MAALE_FIRST = [
  "Aarav", "Aditya", "Arjun", "Karthik", "Nikhil", "Rohan", "Manjunath", "Sanjay",
  "Vinay", "Manish", "Prashanth", "Harsh", "Akash", "Yash", "Kiran", "Raghav",
  "Tejas", "Sourabh", "Chetan", "Dinesh", "Harish", "Mahesh", "Nithin", "Praveen",
  "Rakesh", "Sandeep", "Suresh", "Vinod", "Yogesh", "Abhishek", "Bharath", "Chandan",
  "Deepak", "Girish", "Jeevan", "Lokesh", "Murali", "Naveen", "Omkar", "Pawan",
  "Raju", "Santosh", "Tarun", "Varun", "Anil", "Arun", "Dayanand", "Eshwar",
  "Gopal", "Hanumanth", "Indrajit", "Jagadeesh", "Kalyan", "Laxman", "Mallesh",
  "Nagaraj", "Pramod", "Shiva", "Uday", "Vinayak", "Faizan", "Ibrahim", "Sameer",
  "Zaid", "Gurpreet", "Harjeet", "Manjot", "Amritpal", "Jaswinder", "Rupinder",
];
const FEMALE_FIRST = [
  "Aishwarya", "Ananya", "Bhavana", "Chaitra", "Deepa", "Divya", "Eshwari",
  "Gayathri", "Harshini", "Indira", "Jagrathi", "Kavya", "Lakshmi", "Manasa",
  "Nandini", "Pallavi", "Priya", "Raghavi", "Sangeetha", "Swathi", "Trupthi",
  "Usha", "Vasudha", "Akshata", "Bhargavi", "Chandana", "Darshana", "Gowri",
  "Hemalatha", "Jyothi", "Keerthi", "Meghana", "Nithya", "Padma", "Rakshitha",
  "Shruti", "Tejaswini", "Vaishnavi", "Yashaswini", "Amrutha", "Bindu", "Deepthi",
  "Girija", "Jyoti", "Latha", "Malathi", "Nirmala", "Poornima", "Savitha",
  "Thulasi", "Vanitha", "Aditi", "Bhavika", "Chitra", "Fatima", "Geetha",
  "Hansika", "Isha", "Kanchan", "Lavanya", "Manjula", "Neha", "Radha", "Sanjana",
  "Tanvi", "Ujala", "Vani", "Zoya", "Sameena", "Ayesha", "Nazia", "Heena",
];
// Adult names for guardians — an older generation than the student pool.
const FATHER_FIRST = [
  "Krishna", "Venkatesh", "Rajendra", "Srinivas", "Manjunath", "Harish", "Prakash",
  "Dinesh", "Ramesh", "Suresh", "Mahesh", "Gangadhar", "Nagesh", "Rangappa",
  "Thammaiah", "Siddaiah", "Mallesh", "Basavaraj", "Shivaraj", "Ashok", "Ravi",
  "Santosh", "Anil", "Sunil", "Gopal", "Krishnappa", "Mallappa", "Narasimha",
  "Chandrashekhar", "Venkataramana", "Mohan", "Sridhar", "Naveena", "Puttrappa",
  "Yallappa", "Chalapathi", "Rudrappa", "Shivappa", "Hanumantha", "Basanagouda",
  "Irshad", "Salim", "Javed", "Harbhajan", "Balbir", "Gurdeep", "Satnam",
];
const MOTHER_FIRST = [
  "Lakshmi", "Saroja", "Kausalya", "Radha", "Sridevi", "Anitha", "Shanthi",
  "Lalitha", "Padma", "Prema", "Vasanthi", "Chitra", "Rekha", "Sunitha",
  "Malathi", "Kavitha", "Suma", "Rama", "Savitri", "Gowri", "Bhavani", "Nandini",
  "Jayashree", "Shilpa", "Manjula", "Asha", "Beena", "Deepa", "Usha", "Vijaya",
  "Anandhi", "Sudha", "Rohini", "Sarala", "Vimala", "Bhagyavathi", "Fatema",
  "Shabana", "Nazneen", "Simran", "Gurpreet Kaur", "Jaswinder Kaur",
];
// A mother often keeps her maiden surname, so a student whose guardian is the
// mother need not share the student's surname.
const MAIDEN_SURNAMES = [
  "Kulkarni", "Patil", "Iyer", "Nair", "Menon", "Naidu", "Joshi", "Deshpande",
  "Bhat", "Shastri", "Prasad", "Reddy", "Gowda", "Krishnan", "Pillai",
];

// Realistic Indian mobile prefixes, skewed to Karnataka operators.
const MOBILE_PREFIXES = [
  "9845", "9945", "9731", "9632", "9448", "9740", "9886", "8884", "8546",
  "9035", "9380", "9946", "8197", "9108", "8895", "7022", "6363", "7339",
  "8123", "9739", "9846", "9902", "9449", "8095", "9633",
];
const mobile = () => pick(MOBILE_PREFIXES) + String(int(0, 9999999)).padStart(7, "0");
// Tumakuru landline numbers carry the 08182 STD code.
const landline = () => `08182 ${int(200000, 299999)}`;

const EMAIL_DOMAINS = [
  ["gmail.com", 62], ["yahoo.in", 12], ["rediffmail.com", 8],
  ["outlook.com", 8], ["hotmail.com", 5], ["gmail.co.in", 5],
];
const personalEmail = (name) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${weighted(EMAIL_DOMAINS)}`;

// ------------------------------------------------------------- localities --
// Every locality carries its own pincode and taluk so an address is internally
// consistent, and each maps to the bus route that actually serves it.
// Street names deliberately omit the area name, since the area is its own
// field — otherwise the address reads "Temple Street, X, X, Tumakuru".
const LOCALITIES = [
  { area: "Sira Road", taluk: "Tumakuru", pincode: "572101", route: "RT-01",
    streets: ["1st Cross", "4th Cross", "Main Road", "Vidyaranyapura Road"] },
  { area: "Vidyaranyapura", taluk: "Tumakuru", pincode: "572101", route: "RT-01",
    streets: ["2nd Cross", "Kalidasa Road", "Gandhi Bazaar Road"] },
  { area: "Siddamanahalli", taluk: "Tumakuru", pincode: "572102", route: "RT-01",
    streets: ["Main Road", "Temple Street", "School Road", "Rice Mill Road"] },
  { area: "Huliyar", taluk: "Tumakuru", pincode: "572104", route: "RT-02",
    streets: ["Main Road", "3rd Cross", "Bazzar Road"] },
  { area: "Kalyanapura", taluk: "Tumakuru", pincode: "572104", route: "RT-02",
    streets: ["Kalyanapura Road", "2nd Cross", "New Layout"] },
  { area: "Malaguni", taluk: "Tumakuru", pincode: "572104", route: "RT-02",
    streets: ["Main Road", "Canal Road"] },
  { area: "Gubbi", taluk: "Gubbi", pincode: "572105", route: "RT-03",
    streets: ["Main Road", "Bus Stand Road", "Rice Mill Road"] },
  { area: "Nittur", taluk: "Gubbi", pincode: "572105", route: "RT-03",
    streets: ["Cross Road", "Temple Road", "2nd Cross"] },
  { area: "Nagavalli", taluk: "Gubbi", pincode: "572105", route: "RT-03",
    streets: ["Main Road", "4th Cross"] },
  { area: "Kunigal", taluk: "Kunigal", pincode: "572115", route: "RT-04",
    streets: ["Main Road", "Railway Station Road", "5th Cross"] },
  { area: "Bheemanahalli", taluk: "Kunigal", pincode: "572115", route: "RT-04",
    streets: ["Main Road", "Gram Panchayat Road"] },
  { area: "Honnavarahalli", taluk: "Kunigal", pincode: "572115", route: "RT-04",
    streets: ["Main Road", "Lake Road"] },
  { area: "Tumakuru City", taluk: "Tumakuru", pincode: "572101", route: null,
    streets: ["2nd Cross, Gandhi Nagar", "8th Main, Ashokapuram", "Jayanagar 4th Block", "Tilak Road"] },
  { area: "Jayanagar", taluk: "Tumakuru", pincode: "572101", route: null,
    streets: ["4th Block", "11th Cross", "Park Road"] },
  { area: "Kuppannoor", taluk: "Tumakuru", pincode: "572103", route: null,
    streets: ["Main Road", "Milk Dairy Road"] },
  { area: "Amaravathi Colony", taluk: "Tumakuru", pincode: "572103", route: null,
    streets: ["3rd Cross", "Nehru Nagar", "Main Road"] },
  { area: "Madhugiri Road", taluk: "Tumakuru", pincode: "572103", route: null,
    streets: ["Madhugiri Main Road", "Rangoli Layout"] },
  { area: "Tiptur Road", taluk: "Tumakuru", pincode: "572102", route: null,
    streets: ["Tiptur Road Cross", "Bypass Road"] },
  { area: "Chikkabagalur", taluk: "Tumakuru", pincode: "572102", route: null,
    streets: ["Main Road", "Lake Side Road"] },
  { area: "Sulthanahalli", taluk: "Tumakuru", pincode: "572103", route: null,
    streets: ["Main Road", "Grama Panchayat Road"] },
];
const locality = () => pick(LOCALITIES);

function makeAddress(loc) {
  const line1 = `${int(1, 240)}, ${pick(loc.streets)}`;
  const line2 = chance(0.28) ? pick([
    "Near " + pick(["Ganesha Temple", "Govt. School", "Bus Stop", "Market", "Panchayat Office", "Hospital"]),
    "Flat " + int(101, 404),
    "No. " + int(1, 60) + ", " + pick(["Shivalik", "Gokul", "Lakshmi", "Padma", "Sneha"]) + " Layout",
  ]) : null;
  return {
    line1,
    line2,
    area: loc.area,
    taluk: loc.taluk,
    district: "Tumakuru",
    state: "Karnataka",
    pincode: loc.pincode,
  };
}

// ----------------------------------------------------------------- teardown --
async function teardown() {
  console.log("\nWiping existing seed data for the organisation…");
  const invoiceIds = (
    await req("GET", `/rest/v1/invoices?select=id&organisation_id=eq.${ORG_ID}&limit=1000`)
  ).map((r) => r.id);
  const examIds = (
    await req("GET", `/rest/v1/examinations?select=id&organisation_id=eq.${ORG_ID}&limit=1000`)
  ).map((r) => r.id);

  // Every profile except the two pre-existing admins is seed data — including
  // trigger-created profiles that live on junk organisations.
  const profileIds = (await req("GET", "/rest/v1/profiles?select=id&limit=2000"))
    .filter((p) => !KEEP_PROFILE_IDS.has(p.id))
    .map((p) => p.id);

  const orgFilter = `organisation_id=eq.${ORG_ID}`;
  const del = (table, filter) =>
    req("DELETE", `/rest/v1/${table}?${filter}`, { prefer: "return=minimal" }).catch(
      (e) => console.log(`  ! ${table}: ${e.message.split("->")[0]}`)
    );

  await del("audit_logs", orgFilter);
  await del("notifications", orgFilter);
  await del("messages", orgFilter);
  await del("transport_allocations", orgFilter);
  await del("payments", orgFilter);
  if (invoiceIds.length) await deleteInBatches("invoice_items", "invoice_id", invoiceIds);
  await del("invoices", orgFilter);
  if (examIds.length) await deleteInBatches("exam_results", "examination_id", examIds);
  await del("assignments", orgFilter);
  await del("attendance", orgFilter);
  await del("examinations", orgFilter);
  await del("enrollments", orgFilter);
  await del("students", orgFilter);
  await del("classrooms", orgFilter);
  await del("academic_years", orgFilter);
  await del("fee_categories", orgFilter);
  await del("transport_routes", orgFilter);
  await del("announcements", orgFilter);
  await del("staff", orgFilter);
  if (profileIds.length) await deleteInBatches("profiles", "id", profileIds);

  // Remove trigger-created junk organisations (no profiles left on them),
  // but never the three that pre-date the seed.
  const allOrgs = await req("GET", "/rest/v1/organisations?select=id");
  let junkRemoved = 0;
  for (const org of allOrgs) {
    if (KEEP_ORG_IDS.has(org.id)) continue;
    const withProfiles = await countOf("profiles", `&organisation_id=eq.${org.id}`);
    if (withProfiles === 0) {
      await del("organisations", `id=eq.${org.id}`);
      junkRemoved++;
    }
  }
  if (junkRemoved) console.log(`  - removed ${junkRemoved} junk organisations`);

  // Remove the seeded auth users (profile ids == auth user ids).
  for (const id of profileIds) {
    await req("DELETE", `/auth/v1/admin/users/${id}`, {}).catch(() => {});
  }
  console.log(`  removed ${profileIds.length} auth users / profiles`);
}

// The auth trigger creates a junk organisation for every new user. Collect
// those ids (via the auto-created profiles) so we can remove them once the
// real profiles have been merged onto the correct organisation.
async function collectJunkOrgs(userIds) {
  const rows = await req(
    "GET",
    `/rest/v1/profiles?id=in.(${userIds.join(",")})&select=organisation_id`
  );
  return rows.map((r) => r.organisation_id).filter((id) => id && id !== ORG_ID);
}

async function createAuthUsers(jobs) {
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const i = idx++;
      if (!DEFAULT_PASSWORD) {
        throw new Error("Set SEED_PASSWORD before seeding auth users.");
      }
      const res = await req("POST", "/auth/v1/admin/users", {
        body: {
          email: jobs[i].email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: jobs[i].full_name },
        },
      });
      jobs[i].id = res.id;
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
}

// -------------------------------------------------------------------- main --
async function main() {
  const force = process.env.FORCE === "1";
  const existing = await countOf("students", `&organisation_id=eq.${ORG_ID}`);
  if (existing > 0 && !force) {
    console.error(
      `"My School" already has ${existing} student(s). Set FORCE=1 to wipe and reseed.`
    );
    process.exit(1);
  }
  if (force) await teardown();

  console.log('Seeding organisation:', ORG_ID, '("My School")\n');

  // ============================================================== 1. staff ==
  console.log("[1/8] Staff (10)…");
  const STAFF = [
    ["Dr. Meera Iyer", "Principal", "School Leadership", "dr.meera.iyer", "principal"],
    ["Rajesh Menon", "Vice Principal", "School Leadership", "rajesh.menon", "staff"],
    ["Anita Kulkarni", "Mathematics Teacher", "Mathematics", "anita.kulkarni", "teacher"],
    ["Suresh Prabhu", "Science Teacher", "Science", "suresh.prabhu", "teacher"],
    ["Shobha Nair", "English Teacher", "English", "shobha.nair", "teacher"],
    ["Karthik Rao", "Social Studies Teacher", "Social Studies", "karthik.rao", "teacher"],
    ["Divya Thomas", "Computer Science Teacher", "Computer Science", "divya.thomas", "teacher"],
    ["Eklavya Deshmukh", "Physical Education Teacher", "Sports", "eklavya.deshmukh", "teacher"],
    ["Farida Sheikh", "Hindi & Kannada Teacher", "Languages", "farida.sheikh", "teacher"],
    ["Gurpreet Singh", "Librarian & Exam Coordinator", "Library", "gurpreet.singh", "staff"],
  ];
  const staffJobs = STAFF.map(([name, , , slug, role]) => ({
    email: `${slug}@myschool.edu.in`,
    full_name: name,
    role,
  }));
  await createAuthUsers(staffJobs);

  const staffRows = STAFF.map(([name, designation, department], i) => ({
    id: staffJobs[i].id,
    organisation_id: ORG_ID,
    usn: `STF${pad(1001 + i, 4)}`,
    name,
    designation,
    department,
    email: staffJobs[i].email,
    phone: chance(0.88) ? mobile() : landline(),
    joined_on: `${int(2012, 2024)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
    active: true,
    profile_id: staffJobs[i].id,
  }));
  const staffProfiles = STAFF.map(([name, , , , role], i) => ({
    id: staffJobs[i].id,
    organisation_id: ORG_ID,
    full_name: name,
    email: staffJobs[i].email,
    role,
    avatar_url: null,
  }));
  const junkOrgIds = new Set(await collectJunkOrgs(staffJobs.map((j) => j.id)));
  await upsert("profiles", staffProfiles);
  await insert("staff", staffRows);

  // Subject -> teacher, used for results sanity, assignments and messages.
  const SUBJECT_TEACHER = {
    Mathematics: staffRows[2],
    Science: staffRows[3],
    English: staffRows[4],
    "Social Studies": staffRows[5],
    "Computer Science": staffRows[6],
    Hindi: staffRows[8],
    Kannada: staffRows[8],
  };

  // =========================================================== 2. families ==
  // 100 students across 78 households. Siblings share the surname, the house
  // and one guardian login; the second and third child get a tuition discount.
  console.log("[2/8] Families & students (100 students in 78 households)…");

  const householdSizes = [];
  for (let i = 0; i < 60; i++) householdSizes.push(1); // 60 single-child
  for (let i = 0; i < 14; i++) householdSizes.push(2); // 14 with two
  for (let i = 0; i < 4; i++) householdSizes.push(3); // 4 with three
  // 60 + 28 + 12 = 100 children in 78 households.
  // Shuffle so large families are not all created first.
  for (let i = householdSizes.length - 1; i > 0; i--) {
    const j = int(0, i);
    [householdSizes[i], householdSizes[j]] = [householdSizes[j], householdSizes[i]];
  }

  // Exactly 20 students per grade, but siblings must land in different grades.
  const gradeCapacity = { 6: 20, 7: 20, 8: 20, 9: 20, 10: 20 };
  const GRADES = [6, 7, 8, 9, 10];

  const families = householdSizes.map((size) => {
    const surname = surnamePool();
    const loc = locality();
    const guardianIsMother = chance(0.19);
    // A mother frequently keeps her maiden surname; the student still carries
    // the father's surname.
    const guardianSurname = guardianIsMother && chance(0.45) ? pick(MAIDEN_SURNAMES) : surname;
    const gFirst = guardianIsMother ? pick(MOTHER_FIRST) : pick(FATHER_FIRST);
    const guardianName = `${gFirst} ${guardianSurname}`;

    // Grades: keep siblings at least 2 grades apart where the pool allows.
    const grades = [];
    for (let c = 0; c < size; c++) {
      const open = GRADES.filter((g) => gradeCapacity[g] > 0);
      let ok = open.filter((g) => grades.every((x) => Math.abs(x - g) >= 2));
      if (!ok.length) ok = open;
      const g = pick(ok);
      gradeCapacity[g]--;
      grades.push(g);
    }

    // Payment reliability is a family trait, not a per-invoice coin flip.
    const reliability = clamp(gauss(0.8, 0.16), 0.25, 0.99);

    return {
      surname,
      locality: loc,
      address: makeAddress(loc),
      guardianName,
      guardianIsMother,
      guardianPhone: chance(0.87) ? mobile() : landline(),
      guardianEmail: null, // filled once uniqueness is known
      grades,
      reliability,
      children: [],
    };
  });

  // Unique guardian logins across the whole school.
  const usedEmails = new Set();
  for (const fam of families) {
    let email = personalEmail(fam.guardianName);
    let n = 2;
    while (usedEmails.has(email)) {
      email = personalEmail(`${fam.guardianName} ${n++}`);
    }
    usedEmails.add(email);
    fam.guardianEmail = email;
  }

  // Flatten into student records.
  const students = [];
  for (const fam of families) {
    fam.children = fam.grades.map((grade, c) => {
      // Older siblings sit in the higher grade.
      const gender = weighted([["male", 51], ["female", 48], ["other", 1]]);
      const first =
        gender === "female" ? pick(FEMALE_FIRST) : gender === "male" ? pick(MAALE_FIRST) : pick(["Aarav", "Ananya", "Kiran", "Sanjana"]);
      // Age at the start of the academic year: grade + 5 … grade + 6 years.
      const ageYears = grade + 5 + rand() * 0.95;
      const entry = new Date(TERM_START + "T00:00:00Z").getTime();
      const dateOfBirth = iso(new Date(entry - ageYears * 365.2425 * DAY));

      // Most children joined when the year opened; a few came in later.
      const joinedOn = weighted([
        ["2026-04-06", 74],
        ["2025-11-03", 12],
        ["2026-06-15", 7],
        ["2026-07-20", 4],
        ["2026-08-24", 3],
      ]);

      // Two students left during the year (transfer certificate issued).
      const leaving = chance(0.02) ? weighted([["2026-07-18", 1], ["2026-06-27", 1], ["2026-08-15", 1]]) : null;

      // Seniors get a school email; younger children simply do not have one.
      const email =
        grade >= 9
          ? `${first}.${fam.surname}@gks.edu.in`.toLowerCase()
          : chance(0.22)
            ? `${first}.${fam.surname}${int(1, 99)}@gks.edu.in`.toLowerCase()
            : null;

      const s = {
        id: uuid(),
        organisation_id: ORG_ID,
        usn: null,
        first_name: first,
        last_name: fam.surname,
        date_of_birth: dateOfBirth,
        gender,
        email,
        phone: grade >= 8 ? mobile() : null,
        guardian_name: fam.guardianName,
        guardian_email: fam.guardianEmail,
        guardian_phone: fam.guardianPhone,
        address: fam.address,
        joined_on: joinedOn,
        status: leaving ? "inactive" : "active",
        photo_url: null,

        // internal, stripped before insert
        family: fam,
        familyIndex: c,
        siblingIndex: c,
        siblingCount: fam.grades.length,
        grade,
        leavingOn: leaving,
        // latent academic traits
        ability: gauss(0, 1),
        stemTilt: gauss(0, 1),
        affinity: {},
        // attendance propensity (fraction of school days present)
        attendanceRate: null,
        lateProne: chance(0.3),
      };
      students.push(s);
      return s;
    });
  }

  // USNs follow the date of joining, the way a real register does.
  const byJoin = [...students].sort(
    (a, b) => a.joined_on.localeCompare(b.joined_on) || a.last_name.localeCompare(b.last_name)
  );
  // The school's own shape: initials and four digits, starting at 1001.
  byJoin.forEach((s, i) => (s.usn = `GGS${pad(i + 1001, 4)}`));

  // Guardian auth accounts: one login per household.
  const guardianJobs = families.map((fam) => ({
    email: fam.guardianEmail,
    full_name: fam.guardianName,
  }));
  await createAuthUsers(guardianJobs);
  families.forEach((fam, i) => (fam.guardianId = guardianJobs[i].id));

  for (const id of await collectJunkOrgs(guardianJobs.map((j) => j.id))) junkOrgIds.add(id);
  await upsert(
    "profiles",
    families.map((fam) => ({
      id: fam.guardianId,
      organisation_id: ORG_ID,
      full_name: fam.guardianName,
      email: fam.guardianEmail,
      role: "parent",
      avatar_url: null,
    }))
  );

  if (junkOrgIds.size) {
    await deleteInBatches("organisations", "id", [...junkOrgIds]);
    console.log(`  - organisations: removed ${junkOrgIds.size} trigger-created junk orgs`);
  }

  await insert(
    "students",
    students.map((s) => ({
      id: s.id,
      organisation_id: ORG_ID,
      usn: s.usn,
      first_name: s.first_name,
      last_name: s.last_name,
      date_of_birth: s.date_of_birth,
      gender: s.gender,
      email: s.email,
      phone: s.phone,
      guardian_name: s.guardian_name,
      guardian_email: s.guardian_email,
      guardian_phone: s.guardian_phone,
      address: s.address,
      joined_on: s.joined_on,
      status: s.status,
      photo_url: null,
    }))
  );
  const studentsById = new Map(students.map((s) => [s.id, s]));

  // ============================================ 3. year, classrooms, rolls ==
  console.log("[3/8] Academic year, classrooms, enrollments…");
  const academicYear = {
    id: uuid(),
    organisation_id: ORG_ID,
    name: "2026-27",
    starts_on: "2026-04-06",
    ends_on: "2027-03-31",
    is_current: true,
  };
  await insert("academic_years", [academicYear]);

  // Each grade has one homeroom teacher, taken from the subject faculty.
  const HOMEROOM = [staffRows[2], staffRows[3], staffRows[4], staffRows[5], staffRows[6]];
  const classrooms = GRADES.map((grade, i) => ({
    id: uuid(),
    organisation_id: ORG_ID,
    academic_year_id: academicYear.id,
    grade: String(grade),
    section: "A",
    room: `R-${101 + i}`,
    capacity: 30,
    class_teacher_id: HOMEROOM[i].id,
  }));
  await insert("classrooms", classrooms);

  const classroomOfGrade = new Map(GRADES.map((g, i) => [g, classrooms[i]]));
  const enrollments = [];
  for (const s of students) {
    const classroom = classroomOfGrade.get(s.grade);
    // Roll numbers follow USN order within the class.
    const peers = students
      .filter((x) => x.grade === s.grade)
      .sort((a, b) => a.usn.localeCompare(b.usn));
    enrollments.push({
      id: uuid(),
      organisation_id: ORG_ID,
      student_id: s.id,
      classroom_id: classroom.id,
      academic_year_id: academicYear.id,
      roll_no: String(peers.indexOf(s) + 1),
      enrolled_on: s.joined_on,
      active: !s.leavingOn,
    });
  }
  await insert("enrollments", enrollments);
  for (const s of students) s.classroom = classroomOfGrade.get(s.grade);

  // ========================================================= 4. attendance ==
  // Generated per student against their own propensity, with real multi-day
  // illness streaks and a Monday dip — not an independent coin per cell.
  console.log("[4/8] Attendance across the term…");
  const days = schoolDays(TERM_START, TODAY);
  for (const s of students) {
    // A real roll has a long upper tail near 100% but a genuine lower tail too:
    // a few students miss a day a week or more. Drawing every student from one
    // narrow band is what makes mock attendance look fake.
    s.attendanceRate = weighted([
      [gauss(0.975, 0.014), 34], // essentially always present
      [gauss(0.95, 0.016), 27],  // very good
      [gauss(0.915, 0.018), 21], // occasional absences
      [gauss(0.87, 0.022), 12],  // below the 90% benchmark
      [gauss(0.81, 0.026), 5],   // persistent truancy
      [gauss(0.74, 0.03), 1],    // rare, needs a follow-up call
    ]);
    s.attendanceRate = clamp(s.attendanceRate, 0.7, 0.995);
  }

  const ABSENCE_REASONS = [
    "Fever — parents informed",
    "Viral fever, medical certificate submitted",
    "Severe cold and cough",
    "Stomach infection",
    "Reported sick at home",
    "Family function",
    "Dental procedure",
    "Injury — left ankle, advised rest",
    "Absent without information",
    "Eye infection",
  ];
  const LEAVE_REASONS = [
    "Pre-approved medical leave",
    "Family function — prior approval",
    "Sister's wedding",
    "Attending cousin's function out of town",
    "Medical appointment — prior approval",
  ];
  const LATE_REASONS = [
    "Bus arrived late",
    "Traffic delay on Bengaluru Road",
    "Heavy rain on the way",
    "Reason not recorded",
    "Overslept",
  ];

  const attendance = [];
  for (const s of students) {
    const lastDay = s.leavingOn ?? TODAY;
    let streakLeft = 0;
    let streakReason = null;
    for (const day of days) {
      if (day > lastDay) break; // the student had already left the school
      const isMonday = dow(day) === 1;
      let status = "present";
      let notes = null;

      if (streakLeft > 0) {
        status = "absent";
        notes = streakReason;
        streakLeft--;
      } else {
        // Monday dip, and a small bump right after a holiday.
        let p = 1 - s.attendanceRate;
        if (isMonday) p *= 1.35;
        if (HOLIDAYS.has(addDays(day, -1))) p *= 1.2;
        if (rand() < p) {
          if (chance(0.16)) {
            status = "leave";
            notes = pick(LEAVE_REASONS);
          } else {
            status = "absent";
            notes = pick(ABSENCE_REASONS);
            // Sickness comes in streaks, not isolated days.
            if (chance(0.32)) {
              streakLeft = int(1, 2);
              streakReason = pick([
                "Fever — continued medical leave",
                "Viral fever, advised rest at home",
                "Recovering from illness",
              ]);
            }
          }
        } else if (s.lateProne && rand() < 0.035) {
          status = "late";
          notes = pick(LATE_REASONS);
        }
      }

      attendance.push({
        id: uuid(),
        organisation_id: ORG_ID,
        student_id: s.id,
        classroom_id: s.classroom.id,
        attendance_date: day,
        status,
        notes,
        recorded_by: s.classroom.class_teacher_id,
      });
    }
  }
  await insert("attendance", attendance);

  // ================================================== 5. examinations etc. ==
  console.log("[5/8] Examinations & results…");
  const examinations = [
    { id: uuid(), name: "Unit Test 1", starts_on: "2026-08-10", ends_on: "2026-08-20", published: true,
      maxPerSubject: 40, subjects: ["Mathematics", "Science", "English"] },
    { id: uuid(), name: "First Term Examination", starts_on: "2026-09-15", ends_on: "2026-09-30", published: true,
      maxPerSubject: 80,
      subjects: ["Kannada", "English", "Mathematics", "Science", "Social Studies", "Hindi", "Computer Science"] },
    { id: uuid(), name: "Mid-Term Examination", starts_on: "2026-12-01", ends_on: "2026-12-15", published: false,
      maxPerSubject: 80, subjects: [] },
  ].map((e) => ({ ...e, organisation_id: ORG_ID, academic_year_id: academicYear.id }));
  // subjects / maxPerSubject are generator-side fields, not table columns.
  await insert(
    "examinations",
    examinations.map(({ subjects, maxPerSubject, ...e }) => e)
  );

  // Mean score per subject: Mathematics and Science are the hard ones, the
  // language and computer subjects come out easier. Grades 9-10 drop Computer
  // Science from First Term in most schools, so it is added selectively.
  const SUBJECT_MEAN = {
    Mathematics: 0.62,
    Science: 0.63,
    English: 0.68,
    "Social Studies": 0.7,
    Hindi: 0.7,
    Kannada: 0.71,
    "Computer Science": 0.74,
  };
  const STEM = new Set(["Mathematics", "Science", "Computer Science"]);

  for (const s of students) {
    for (const subject of Object.keys(SUBJECT_MEAN)) s.affinity[subject] = gauss(0, 0.45);
  }

  const gradeOf = (pct) =>
    pct >= 0.9 ? "A1" : pct >= 0.8 ? "A2" : pct >= 0.7 ? "B1"
      : pct >= 0.6 ? "B2" : pct >= 0.5 ? "C" : pct >= 0.4 ? "D" : "E";

  const examResults = [];
  // Two students sat the First Term without completing every paper.
  const incompleteExam = new Set([students[int(0, 99)], students[int(0, 99)]]);

  for (const exam of examinations) {
    if (!exam.published) continue; // the Mid-Term has not happened yet
    for (const s of students) {
      if (s.leavingOn && s.leavingOn < exam.starts_on) continue; // left before the exam
      for (const subject of exam.subjects) {
        if (subject === "Computer Science" && s.grade < 9) continue;
        const max = exam.maxPerSubject;

        // The model: a base ability, a STEM/humanities tilt, a personal
        // affinity for the subject, a subject mean, an exam-paper offset and
        // a little noise. Ability dominates, so results are correlated the way
        // a real report card is.
        const stemDir = STEM.has(subject) ? s.stemTilt : -s.stemTilt;
        let pct =
          0.7 +
          0.108 * s.ability +
          0.045 * stemDir +
          0.05 * s.affinity[subject] +
          (SUBJECT_MEAN[subject] - 0.68) +
          (exam.name === "Unit Test 1" ? -0.015 : 0.01) +
          0.042 * gauss(0, 1);
        // A gentle ceiling: nobody scores 100 often.
        if (pct > 0.93) pct = 0.93 + (pct - 0.93) * 0.45;
        pct = clamp(pct, 0.18, 0.995);

        let marks = Math.round(pct * max);
        let grade = gradeOf(marks / max);
        // Marked absent for one paper.
        if (incompleteExam.has(s) && exam.name === "First Term Examination" && subject === "Science") {
          marks = 0;
          grade = "Ab";
        }
        examResults.push({
          id: uuid(),
          examination_id: exam.id,
          student_id: s.id,
          subject,
          marks,
          max_marks: max,
          grade,
        });
      }
    }
  }
  await insert("exam_results", examResults);

  // ======================================================== 6. assignments ==
  console.log("[6/8] Assignments…");
  const assignmentDefs = [
    [6, "Mathematics", "Exercise 4.1 — Real Numbers", "Complete exercises 4.1 to 4.6 from the workbook. Show all working; answers alone will not be marked.", "2026-09-24", "2026-09-18"],
    [6, "English", "Chapter 3 — The Happy Prince ( comprehension)", "Answer the six comprehension questions at the end of the chapter in your notebook.", "2026-09-29", "2026-09-22"],
    [6, "Kannada", "Letter writing — formal", "Write a formal letter to the Principal requesting one week's leave for a family function.", "2026-10-06", "2026-09-28"],
    [7, "Mathematics", "Unit Test 2 — syllabus revision", "Revise chapters 1 to 4. The unit test covers worked examples on linear equations.", "2026-10-05", "2026-09-26"],
    [7, "Science", "Diagram: human digestive system", "Draw and label the human digestive system in your science notebook. Neatness carries marks.", "2026-10-02", "2026-09-21"],
    [7, "Social Studies", "Map work — rivers of Karnataka", "Mark and label the five major rivers of Karnataka on the outline map supplied in class.", "2026-10-08", "2026-09-25"],
    [8, "Mathematics", "Algebra worksheet — factorisation", "Complete worksheet 3, questions 1 to 20. Show the factorisation steps.", "2026-10-07", "2026-09-24"],
    [8, "Science", "Project — water purification at home", "Prepare a chart explaining how water is purified at home, with a labelled diagram.", "2026-10-14", "2026-09-29"],
    [8, "English", "Essay — My City", "Write a 300-word essay on Tumakuru: its history, famous places and what you like about it.", "2026-10-09", "2026-09-26"],
    [9, "Mathematics", "Trigonometry problem set", "Solve problems 1 to 20 from the trigonometry worksheet. Extra credit for questions 21 and 22.", "2026-10-13", "2026-09-28"],
    [9, "Computer Science", "Python — loops practice", "Write five programs using for and while loops: a counter, a factorial, a sum of digits, a pattern and a number check.", "2026-10-06", "2026-09-23"],
    [9, "Science", "Lab report — density of solids", "Submit the lab report for the density experiment, including the observation table and the calculation.", "2026-10-01", "2026-09-19"],
    [10, "Mathematics", "Calculus — limits worksheet", "Complete the limits worksheet. Every question must show the method used.", "2026-10-10", "2026-09-27"],
    [10, "English", "Literature — summary of the prescribed chapter", "Write a 250-word summary and list five important characters with one line on each.", "2026-10-12", "2026-09-30"],
    [10, "Social Studies", "History — Source analysis", "Answer the three source-based questions from the History worksheet and comment on the bias of each source.", "2026-10-15", "2026-10-01"],
    [10, "Computer Science", "SQL — student marksheet query", "Write SQL queries to (a) list all students above 75%, (b) find the class average per subject, (c) count absentees per month.", "2026-10-16", "2026-10-02"],
  ];
  const assignments = assignmentDefs.map(
    ([grade, subject, title, instructions, dueDate, setOn], i) => ({
      id: uuid(),
      organisation_id: ORG_ID,
      classroom_id: classroomOfGrade.get(grade).id,
      subject,
      title,
      instructions,
      due_at: ts(dueDate, 17, 0),
      created_by: (SUBJECT_TEACHER[subject] ?? staffRows[2]).id,
      // kept for reference so notifications can say "due in 3 days"
      dueDate,
      setOn,
      index: i,
    })
  );
  await insert(
    "assignments",
    assignments.map(({ dueDate, setOn, index, ...a }) => a)
  );

  // ============================================ 7. fees and bus routes ==
  console.log("[7/8] Fee structure, transport routes…");
  const feeCategories = [
    { name: "Tuition Fee", description: "Term tuition, varies by grade" },
    { name: "Transport Fee", description: "School bus, charged by route distance" },
    { name: "Laboratory Fee", description: "Science and computer laboratories, grades 8-10" },
    { name: "Library Fee", description: "Library membership and issue privileges" },
    { name: "Sports Fee", description: "Sports equipment and annual meets" },
    { name: "Admission Fee", description: "One-time, charged in the year of joining" },
  ].map((c) => ({ id: uuid(), organisation_id: ORG_ID, active: true, ...c }));
  await insert("fee_categories", feeCategories);
  const CAT = Object.fromEntries(feeCategories.map((c) => [c.name, c.id]));

  // Annual tuition rises with grade, the way a private school's fee card does.
  const TUITION = { 6: 18000, 7: 19500, 8: 21000, 9: 24000, 10: 26000 };
  const transportRoutes = [
    { name: "Sira Road Route", code: "RT-01", vehicle_no: "KA-01-AB-1234", driver_name: "Suresh Kumar", driver_phone: mobile(), fee: 1800,
      stops: ["Sira Road Circle", "Vidyaranyapura", "Kalidasa Road", "Siddamanahalli Cross", "School Gate"] },
    { name: "Huliyar Route", code: "RT-02", vehicle_no: "KA-01-CD-5678", driver_name: "Ramesh Gowda", driver_phone: mobile(), fee: 2000,
      stops: ["Huliyar Bazzar", "Kalyanapura Junction", "Malaguni Canal", "School Gate"] },
    { name: "Gubbi Route", code: "RT-03", vehicle_no: "KA-01-EF-9012", driver_name: "Mahesh Reddy", driver_phone: mobile(), fee: 2600,
      stops: ["Gubbi Bus Stand", "Rice Mill", "Nittur Cross", "Nagavalli", "School Gate"] },
    { name: "Kunigal Route", code: "RT-04", vehicle_no: "KA-01-GH-3456", driver_name: "Prakash N", driver_phone: mobile(), fee: 2200,
      stops: ["Kunigal Railway Station", "Bheemanahalli", "Honnavarahalli Lake", "School Gate"] },
  ].map((r) => ({ id: uuid(), organisation_id: ORG_ID, active: true, ...r }));
  await insert(
    "transport_routes",
    transportRoutes.map(({ stops, fee, ...r }) => r)
  );
  const routeByCode = new Map(transportRoutes.map((r) => [r.code, r]));

  // Bus users come from the areas the route actually serves.
  const allocations = [];
  for (const s of students) {
    const code = s.family.locality.route;
    if (!code) continue;
    // Not everyone on a served street takes the bus.
    if (!chance(0.72)) continue;
    const route = routeByCode.get(code);
    const stop = pick(route.stops.slice(0, -1)); // everyone gets off before the gate
    allocations.push({
      id: uuid(),
      organisation_id: ORG_ID,
      student_id: s.id,
      route_id: route.id,
      stop_name: stop,
      active: true,
    });
    s.transport = { route, stop };
  }
  await insert("transport_allocations", allocations);

  // =========================================== 8. invoices, items, payments ==
  console.log("[8/8] Invoices, items, payments, announcements, messages, notifications…");
  const TERMS = [
    { name: "Term 1", issued: "2026-04-10", due: "2026-07-15" },
    { name: "Term 2", issued: "2026-09-20", due: "2026-10-20" },
  ];

  const invoices = [];
  const invoiceItems = [];
  const payments = [];
  let invoiceSeq = 0;
  let receiptSeq = 0;

  for (const s of students) {
    // A student who joined mid-year is billed from the term they joined.
    const firstTermIndex = s.joined_on > "2026-07-31" ? 1 : 0;
    for (let t = firstTermIndex; t < TERMS.length; t++) {
      const term = TERMS[t];
      if (s.leavingOn && s.leavingOn < term.issued) continue; // left before this term

      const items = [];
      // Sibling discount: 2nd child 10%, 3rd child 20% off tuition.
      const siblingDiscount = s.siblingIndex === 1 ? 0.1 : s.siblingIndex === 2 ? 0.2 : 0;
      // Around 8% of families hold a concession (RTE or a merit scholarship).
      const concession = chance(0.08) ? pick([0.25, 0.33, 0.5]) : 0;
      const tuition = Math.round(
        TUITION[s.grade] / 2 * (1 - siblingDiscount) * (1 - concession)
      );
      items.push({
        category_id: CAT["Tuition Fee"],
        description:
          `Tuition — ${term.name} (Grade ${s.grade})` +
          (siblingDiscount ? ` · sibling discount ${Math.round(siblingDiscount * 100)}%` : "") +
          (concession ? ` · concession ${Math.round(concession * 100)}%` : ""),
        amount: tuition,
      });
      if (t === firstTermIndex) {
        items.push({
          category_id: CAT["Admission Fee"],
          description: "Admission fee — 2026-27",
          amount: 5000,
        });
      }
      if (s.grade >= 8) {
        items.push({ category_id: CAT["Laboratory Fee"], description: `Laboratory fee — ${term.name}`, amount: 1200 });
      }
      items.push({ category_id: CAT["Library Fee"], description: `Library fee — ${term.name}`, amount: 600 });
      items.push({ category_id: CAT["Sports Fee"], description: `Sports fee — ${term.name}`, amount: 400 });
      if (s.transport) {
        items.push({
          category_id: CAT["Transport Fee"],
          description: `Transport — ${s.transport.route.name} (${s.transport.stop})`,
          amount: s.transport.route.fee,
        });
      }

      let total = items.reduce((sum, it) => sum + it.amount, 0);

      // Overdue Term 1 invoices carry a late fine of Rs.100 per week.
      const overdue = term.due < TODAY;
      if (overdue && s.family.reliability < 0.6) {
        const weeks = Math.min(10, Math.floor((Date.parse(TODAY) - Date.parse(term.due)) / (7 * DAY)));
        if (weeks > 0) {
          items.push({
            category_id: null,
            description: `Late payment fine — ${weeks} week${weeks > 1 ? "s" : ""} @ Rs.100`,
            amount: weeks * 100,
          });
          total += weeks * 100;
        }
      }

      // ---- how much was actually paid
      let paidAmount = 0;
      const roll = rand();
      if (!overdue) {
        // Term 2 was only just issued: most families have not paid yet.
        if (roll < s.family.reliability - 0.35) paidAmount = total; // paid early
        else if (roll < s.family.reliability - 0.22) paidAmount = Math.round(total * 0.5); // part payment
      } else {
        if (roll < s.family.reliability) paidAmount = total;
        else if (roll < s.family.reliability + 0.07) paidAmount = Math.round(total * int(30, 70) / 100);
      }
      paidAmount = Math.min(paidAmount, total);

      // ---- status follows from money and the clock, not from a coin flip
      let status;
      if (s.family.reliability > 0.93 && !chance(0.3) && t === 0) status = "draft"; // not yet raised
      else if (paidAmount >= total && total > 0) status = "paid";
      else if (paidAmount > 0) status = "partial";
      else if (overdue) status = "overdue";
      else status = "issued";

      const invoice = {
        id: uuid(),
        organisation_id: ORG_ID,
        student_id: s.id,
        invoice_no: `INV/26-27/${pad(++invoiceSeq, 4)}`,
        total,
        paid_amount: paidAmount,
        due_on: term.due,
        status,
        term: term.name,
        issuedOn: term.issued,
      };
      invoices.push(invoice);
      s.invoices = s.invoices ?? [];
      s.invoices.push(invoice);

      for (const it of items) {
        invoiceItems.push({
          id: uuid(),
          invoice_id: invoice.id,
          category_id: it.category_id,
          description: it.description,
          amount: it.amount,
        });
      }

      // ---- payments behind that figure
      if (paidAmount > 0) {
        const parts = paidAmount < total ? int(1, 2) : 1;
        let remaining = paidAmount;
        for (let p = 0; p < parts; p++) {
          const amount = p === parts - 1 ? remaining : Math.round(paidAmount / parts);
          remaining -= amount;
          if (amount <= 0) continue;
          const method = weighted([
            ["UPI", 44], ["Cash", 19], ["Bank Transfer", 21], ["Cheque", 9], ["Card", 7],
          ]);
          // Paid in school hours on a working day, mostly within 20 days of
          // the invoice but sometimes well after the due date.
          const spread = chance(0.72) ? int(0, 20) : int(21, 78);
          let paidDay = addDays(term.issued, spread);
          if (isWeekend(paidDay) || HOLIDAYS.has(paidDay)) {
            paidDay = addDays(paidDay, 1);
            while (isWeekend(paidDay) || HOLIDAYS.has(paidDay)) paidDay = addDays(paidDay, 1);
          }
          if (paidDay > TODAY) paidDay = TODAY;
          payments.push({
            id: uuid(),
            organisation_id: ORG_ID,
            invoice_id: invoice.id,
            amount,
            method,
            reference:
              method === "UPI" ? String(int(100000000000, 999999999999))
                : method === "Bank Transfer" ? `UTR${int(10, 99)}${int(10000000000, 99999999999)}`
                : method === "Cheque" ? `CHQ ${int(100001, 999999)} / ${pick(["SBI", "Karnataka Bank", "Canara Bank", "Axis Bank"])}`
                : method === "Card" ? `**** **** **** ${int(1000, 9999)}`
                : null, // cash has no reference
            receipt_no: `RCP/26-27/${pad(++receiptSeq, 4)}`,
            paid_at: ts(paidDay, int(9, 16), int(0, 59)),
          });
        }
      }
    }
  }

  // A couple of invoices raised in error and voided.
  for (const inv of invoices.filter((i) => i.status === "draft").slice(0, 2)) {
    inv.status = "void";
  }
  await insert("invoices", invoices.map(({ term, issuedOn, ...i }) => i));
  await insert("invoice_items", invoiceItems);
  await insert("payments", payments);

  // ------------------------------------------------------ announcements ---
  const announcements = [
    ["Ganesh Chaturthi and school closure", "all",
      "The school will remain closed on Monday 14 September 2026 for Ganesh Chaturthi and on Friday 25 September 2026 for Anant Chaturdashi. Classes resume the next working day.", "2026-09-10T09:00:00+05:30", true],
    ["First Term Examination — results published", "parents",
      "First Term Examination results have been published. Parents may collect the report cards from the school office between 9:00 AM and 3:00 PM, and may raise queries with the class teacher within seven days.", "2026-10-01T16:30:00+05:30", true],
    ["Parent–Teacher Meeting — Grades 6 to 10", "parents",
      "The parent–teacher meeting is scheduled for Saturday 18 October 2026 from 9:30 AM to 1:00 PM. Slots are 15 minutes each; please carry the report card.", "2026-09-28T10:00:00+05:30", true],
    ["Term 2 fee payment", "parents",
      "Term 2 invoices have been raised and are due on 20 October 2026. A late payment fine of Rs.100 per week applies to Term 1 balances still outstanding. Fees may be paid at the office or by UPI.", "2026-09-20T09:00:00+05:30", true],
    ["Sports day selection trials", "students",
      "Trials for the Annual Sports Day will be held during the last period from Monday. Students interested in athletics, kho-kho, kabaddi and football should report to the PE department.", "2026-09-30T08:30:00+05:30", true],
    ["Library week — extended hours", "students",
      "The library will remain open until 4:30 PM during library week from 5 October. Two new reference books have been added for the Social Studies department.", "2026-10-02T12:00:00+05:30", true],
    ["Staff meeting — term review", "staff",
      "A staff meeting to review the First Term performance is scheduled for Saturday 17 October 2026 at 9:00 AM in the staff room. Attendance is compulsory for all teaching staff.", "2026-10-01T11:00:00+05:30", false],
    ["Mid-Term Examination — syllabus", "all",
      "The Mid-Term Examination will be held from 1 to 15 December 2026. The syllabus is the First Term syllabus plus chapters 5 and 6 of each subject, and will be circulated by the subject teachers.", "2026-10-02T15:00:00+05:30", false],
  ].map(([title, audience, body, publishedAt]) => ({
    id: uuid(),
    organisation_id: ORG_ID,
    title,
    audience,
    body,
    published_at: publishedAt,
    created_by: ADMIN_ID,
  }));
  await insert("announcements", announcements);

  // ------------------------------------------------------------- messages ---
  // Messages reference real students, real grades and real invoices.
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const partialInvoices = invoices.filter((i) => i.status === "partial");
  const messages = [];
  const addMessage = (senderId, recipientId, subject, body, status, when) =>
    messages.push({
      id: uuid(),
      organisation_id: ORG_ID,
      sender_id: senderId,
      recipient_id: recipientId,
      subject,
      body,
      status,
      created_at: when,
    });

  // Guardian -> class teacher, about that guardian's own child.
  const parentQueries = [
    (s) => `Doubt in the trigonometry chapter — ${s.first_name}`,
    (s) => `${s.first_name} was absent on Monday`,
    (s) => `Term 1 fee receipt for ${s.first_name}`,
    (s) => `${s.first_name} — request for extra classes in Science`,
    (s) => `Medical leave for ${s.first_name} on Friday`,
  ];
  for (const inv of [...overdueInvoices.slice(0, 3), ...partialInvoices.slice(0, 2)]) {
    const s = studentsById.get(inv.student_id);
    if (!s) continue;
    const teacher = SUBJECT_TEACHER[Math.floor(rand() * 3) + 2] ?? staffRows[2];
    addMessage(
      s.family.guardianId,
      teacher.id,
      parentQueries[messages.length % parentQueries.length](s),
      `Respected sir/madam, this is regarding ${s.first_name} (Grade ${s.grade}, USN ${s.usn}). ${inv.status === "overdue" ? `We are still arranging the ${inv.term} fee of Rs.${inv.total.toLocaleString("en-IN")} and would like to clear it by the end of the month.` : `We have paid Rs.${inv.paid_amount.toLocaleString("en-IN")} against the ${inv.term} invoice and will pay the balance shortly.`} Kindly advise.`,
      chance(0.5) ? "read" : "unread",
      ts(addDays("2026-09-24", int(0, 8)), int(8, 19), int(0, 59))
    );
  }
  // Attendance follow-up, sent by the class teacher to the guardian.
  for (const s of students.filter((x) => x.attendanceRate < 0.9).slice(0, 3)) {
    addMessage(
      s.classroom.class_teacher_id ? staffRows.find((t) => t.id === s.classroom.class_teacher_id).id : staffRows[2].id,
      s.family.guardianId,
      `Attendance follow-up — ${s.first_name} (Grade ${s.grade})`,
      `Dear parent, ${s.first_name}'s attendance this term has been below the 90% benchmark. Could you please share the reason so we can support the family? We would like to arrange a catch-up plan before the Mid-Term.`,
      "read",
      ts(addDays("2026-09-25", int(0, 7)), int(9, 18), int(0, 59))
    );
  }
  // Staff -> staff, and principal -> staff.
  addMessage(staffRows[1].id, ADMIN_ID, "Leave application — 12 October",
    "I would like to apply for casual leave on 12 October 2026 for a family function. The class-teacher duty for Grade 6 has been handed over to Ms. Kulkarni and the exam duty register has been updated.",
    "unread", ts("2026-10-01", 10, 15));
  addMessage(ADMIN_ID, staffRows[1].id, "Approved — leave on 12 October",
    "Approved. Please ensure the Grade 6 duty roster and the Term 2 marks upload are handed over before you leave.",
    "read", ts("2026-10-01", 11, 2));
  addMessage(staffRows[2].id, staffRows[0].id, "Grade 6 Mathematics — term summary",
    "The Unit Test 1 average for Grade 6 is 62% with a spread of 28 to 96. Three students are struggling with real numbers; I propose a Saturday remedial batch from 10 October.",
    "read", ts("2026-09-26", 16, 40));
  addMessage(staffRows[3].id, staffRows[0].id, "Laboratory safety inspection",
    "The science laboratory inspection has been completed. Two gas taps need servicing before the practical exams; I have raised it with the maintenance contractor.",
    "read", ts("2026-09-29", 14, 20));
  addMessage(staffRows[4].id, staffRows[0].id, "First Term results uploaded",
    "All First Term results for Grades 6 to 10 are uploaded. Eight students are below 40% in two or more subjects and need a remedial plan before the Mid-Term.",
    "read", ts("2026-10-01", 17, 5));
  addMessage(staffRows[9].id, ADMIN_ID, "Exam duty allocation",
    "The Mid-Term invigilator duty list for December is ready for approval. Two teachers have clashing duties on 4 December and I have proposed a swap.",
    "unread", ts("2026-10-02", 9, 45));
  addMessage(ADMIN_ID, staffRows[5].id, "Social Studies — syllabus revision",
    "Please add a source-analysis worksheet to the Grade 10 Social Studies section before the Mid-Term; the students responded well to it this term.",
    "read", ts("2026-09-30", 12, 10));
  addMessage(staffRows[6].id, staffRows[2].id, "Computer lab — software update",
    "The Grade 9 and 10 machines are on Python 3.12 now. Grade 6 and 7 will stay on the Python 3.9 image until the November break.",
    "read", ts("2026-09-28", 15, 35));
  addMessage(staffRows[7].id, staffRows[0].id, "Sports day — team lists",
    "Team lists for the Annual Sports Day are attached in the register. I need approval for two additional ground bookings on 8 and 9 November.",
    "unread", ts("2026-10-01", 13, 25));
  addMessage(staffRows[8].id, staffRows[0].id, "Kannada textbook shortfall",
    "The Grade 7 Kannada textbooks have not arrived. I have been teaching from the Grade 8 copies; the vendor has promised delivery by 6 October.",
    "read", ts("2026-09-27", 11, 50));
  addMessage(ADMIN_ID, staffRows[9].id, "Library — new issue register",
    "Please set up the new issue register from Term 2 and circulate the borrowing policy to all classes.",
    "read", ts("2026-09-22", 10, 30));
  await insert("messages", messages);

  // -------------------------------------------------------- notifications --
  // Every notification points at something that is actually true in the data.
  const notifications = [];
  const notify = (profileId, title, body, link, readAt, createdAt) =>
    notifications.push({
      id: uuid(),
      organisation_id: ORG_ID,
      profile_id: profileId,
      title,
      body,
      link,
      read_at: readAt ?? null,
      created_at: createdAt,
    });

  for (const inv of overdueInvoices.slice(0, 22)) {
    const s = studentsById.get(inv.student_id);
    if (!s) continue;
    notify(
      s.family.guardianId,
      `Fee overdue — ${inv.invoice_no}`,
      `The ${inv.term} fee of Rs.${inv.total.toLocaleString("en-IN")} for ${s.first_name} was due on ${inv.due_on}. A fine of Rs.100 per week applies until it is cleared.`,
      "/dashboard/finance",
      chance(0.35) ? ts("2026-09-30", int(9, 18), int(0, 59)) : null,
      ts(addDays(inv.due_on, 7), int(9, 18), int(0, 59))
    );
  }
  for (const inv of partialInvoices.slice(0, 8)) {
    const s = studentsById.get(inv.student_id);
    if (!s) continue;
    const balance = inv.total - inv.paid_amount;
    notify(
      s.family.guardianId,
      `Balance pending — ${inv.invoice_no}`,
      `A balance of Rs.${balance.toLocaleString("en-IN")} is outstanding on the ${inv.term} invoice for ${s.first_name}.`,
      "/dashboard/finance",
      chance(0.3) ? ts("2026-10-01", int(9, 18), int(0, 59)) : null,
      ts(inv.issuedOn, int(9, 18), int(0, 59))
    );
  }
  // First Term results are genuinely published, so every family is told.
  for (const s of students.filter((x) => !x.leavingOn).slice(0, 34)) {
    const results = examResults.filter((r) => r.student_id === s.id && r.grade !== "Ab");
    if (!results.length) continue;
    const pct = Math.round(
      results.reduce((sum, r) => sum + r.marks / r.max_marks, 0) / results.length * 100
    );
    notify(
      s.family.guardianId,
      "First Term results published",
      `The First Term Examination report for ${s.first_name} (Grade ${s.grade}) is now available. Overall percentage: ${pct}%.`,
      "/dashboard/exams",
      chance(0.55) ? ts("2026-10-01", int(16, 20), int(0, 59)) : null,
      ts("2026-10-01", 16, 30)
    );
  }
  // Assignment reminders, only for the classes that actually have one due.
  const dueSoon = assignments.filter((a) => a.dueDate > TODAY && a.dueDate <= addDays(TODAY, 7));
  for (const a of dueSoon) {
    const affected = students.filter(
      (s) => s.classroom.id === a.classroom_id && !s.leavingOn
    );
    for (const s of affected.slice(0, 6)) {
      notify(
        s.family.guardianId,
        `Assignment due — ${a.subject}`,
        `${a.title} for ${s.first_name} is due on ${a.dueDate}.`,
        "/dashboard/academics",
        chance(0.25) ? ts("2026-10-02", int(8, 12), int(0, 59)) : null,
        ts(a.setOn, int(9, 17), int(0, 59))
      );
    }
  }
  // Staff notifications.
  for (const s of staffRows) {
    if (s.designation.includes("Principal")) {
      notify(s.id, "Term 2 fee collection", "Term 2 collection stands at 21% of the target. Eight Term 1 balances are more than 60 days overdue.", "/dashboard/finance", null, ts("2026-10-02", 9, 5));
    } else if (s.department === "Mathematics") {
      notify(s.id, "Marks upload pending", "Please complete the Mid-Term marks upload by 28 November.", "/dashboard/exams", null, ts("2026-10-01", 10, 20));
    } else if (s.department === "Science") {
      notify(s.id, "Lab practical timetable", "The practical examination timetable for Grades 9 and 10 has been circulated.", "/dashboard/academics", ts("2026-09-29", 12, 0), ts("2026-09-29", 11, 45));
    } else if (s.department === "Sports") {
      notify(s.id, "Ground booking approval", "Two additional ground bookings on 8 and 9 November await approval.", "/dashboard", null, ts("2026-10-01", 13, 30));
    } else if (s.department === "Library") {
      notify(s.id, "New issue register", "Please set up the Term 2 issue register and circulate the borrowing policy.", "/dashboard", ts("2026-09-22", 11, 0), ts("2026-09-22", 10, 40));
    } else {
      notify(s.id, "Parent–teacher meeting", `PTM duty for 18 October has been assigned to you. Please confirm your 15-minute slots.`, "/dashboard", chance(0.5) ? ts("2026-10-01", 10, 0) : null, ts("2026-09-30", 15, 10));
    }
  }
  await insert("notifications", notifications);

  // ------------------------------------------------------------ audit logs --
  // A handful of meaningful entries; the database triggers log the row-level
  // detail on their own.
  const auditLogs = [
    ["academic_years", academicYear.id, "create", null, { name: "2026-27", starts_on: "2026-04-06" }],
    ["students", students[0].id, "import", null, { imported: students.length, source: "2026 admissions register" }],
    ["staff", staffRows[0].id, "update", { designation: "Principal" }, { designation: "Principal", email: staffRows[0].email }],
    ["examinations", examinations[1].id, "publish", { published: false }, { published: true, published_at: "2026-10-01" }],
    ["invoices", invoices[0].id, "create", null, { invoice_no: invoices[0].invoice_no, total: invoices[0].total }],
    ["fee_categories", feeCategories[0].id, "update", null, { tuition_by_grade: TUITION, effective_from: "2026-04-01" }],
  ].map(([entity_type, entity_id, action, before_data, after_data]) => ({
    organisation_id: ORG_ID,
    entity_type,
    entity_id,
    action,
    actor_id: ADMIN_ID,
    before_data,
    after_data,
  }));
  try {
    await insert("audit_logs", auditLogs);
  } catch (e) {
    console.log(`  ! audit_logs skipped: ${e.message.split("\n")[0]}`);
  }

  // -------------------------------------------------------------- verify ----
  console.log("\nVerification:");
  for (const t of [
    "profiles", "staff", "students", "academic_years", "classrooms",
    "enrollments", "attendance", "examinations", "assignments",
    "fee_categories", "invoices", "payments", "transport_routes",
    "transport_allocations", "announcements", "messages", "notifications",
    "audit_logs",
  ]) {
    const n = await countOf(t, `&organisation_id=eq.${ORG_ID}`);
    console.log(`  ${t.padEnd(22)} ${n}`);
  }
  console.log(`  ${"exam_results".padEnd(22)} ${await countOf("exam_results")}`);
  console.log(`  ${"invoice_items".padEnd(22)} ${await countOf("invoice_items")}`);

  // Quick realism self-check, so a regression shows up here and not in review.
  const attByStudent = new Map();
  for (const a of attendance) {
    const cur = attByStudent.get(a.student_id) ?? { total: 0, present: 0 };
    cur.total++;
    if (a.status === "present" || a.status === "late") cur.present++;
    attByStudent.set(a.student_id, cur);
  }
  const rates = [...attByStudent.values()].map((v) => v.present / v.total);
  const gradeCounts = {};
  for (const r of examResults) gradeCounts[r.grade] = (gradeCounts[r.grade] ?? 0) + 1;
  console.log("\nRealism check:");
  console.log(`  attendance: mean ${(rates.reduce((a, b) => a + b, 0) / rates.length * 100).toFixed(1)}%, range ${(Math.min(...rates) * 100).toFixed(0)}–${(Math.max(...rates) * 100).toFixed(0)}%`);
  console.log(`  grade spread: ${JSON.stringify(gradeCounts)}`);
  console.log(`  distinct fee totals: ${new Set(invoices.map((i) => i.total)).size} across ${invoices.length} invoices`);
  console.log(`  school days marked: ${days.length} (holidays excluded)`);

  console.log("\nDone! Seeded accounts (password: from SEED_PASSWORD):");
  console.log("  Admin   : kaizxark@gmail.com (existing account, untouched)");
  console.log(`  Staff   : ${staffJobs[0].email} … ${staffJobs[9].email}`);
  console.log(`  Guardian : ${families[0].guardianEmail} … ${families[families.length - 1].guardianEmail}`);
  console.log(`             (${families.length} guardian logins — one per household, siblings share one)`);
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
