#!/usr/bin/env node
/**
 * One-off: give every student and member of staff a USN login, a test mailbox,
 * a date-of-birth password and (for staff) a test date of birth.
 *
 * The USN is the existing USN / employee code with punctuation
 * removed, lowercased: adm26270001 -> adm26270001, EMP-2012-026 ->
 * emp2012026. Existing values are kept; nothing is renumbered.
 *
 * Supabase auth addresses must stay unique, so `profiles.email` and the auth
 * user's email are left alone. The address on the student/staff record is set
 * to one of the three test mailboxes, and that is where the OTP is delivered.
 *
 * Usage:
 *   node scripts/assign-usn-logins.mjs
 *   node scripts/assign-usn-logins.mjs --dry-run
 */

import fs from "node:fs";

const SUPABASE_URL = "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  "REDACTED-SUPABASE-SECRET-KEY";
const ORG_ID = "2f6cbae9-ed79-45e3-819c-a8c80eee7a0f";
const TEST_EMAILS = [
  "kaizxark@gmail.com",
  "sincejuly7th@gmail.com",
  "kaizxark0@gmail.com",
];
const SETTING_KEY = "staff_test_dobs";
const DRY = process.argv.includes("--dry-run");

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function req(method, path, body, prefer) {
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
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

function compact(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function ddmmDate(value) {
  const raw = String(value ?? "").trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, year, month, day] = match;
  const mm = Number(month);
  const dd = Number(day);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const check = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(check.getTime())) return null;
  if (check.getUTCMonth() + 1 !== mm || check.getUTCDate() !== dd) return null;
  return `${String(dd).padStart(2, "0")}${String(mm).padStart(2, "0")}${year.slice(2)}`;
}

function testDob(index) {
  const year = 1975 + (index % 25);
  const month = (index % 12) + 1;
  const day = 10 + (index % 15);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function main() {
  const [students, staff, profiles, existingSetting] = await Promise.all([
    req(
      "GET",
      `/rest/v1/students?select=id,usn,first_name,last_name,date_of_birth,email,organisation_id&organisation_id=eq.${ORG_ID}&order=usn.asc&limit=5000`
    ),
    req(
      "GET",
      `/rest/v1/staff?select=id,employee_code,name,email,profile_id,organisation_id&organisation_id=eq.${ORG_ID}&order=employee_code.asc&limit=5000`
    ),
    req(
      "GET",
      `/rest/v1/profiles?select=id,full_name,email,username,role,student_id&organisation_id=eq.${ORG_ID}&limit=5000`
    ),
    req(
      "GET",
      `/rest/v1/settings?select=value&key=eq.${SETTING_KEY}&limit=1`
    ),
  ]);

  const profileByStudent = new Map();
  for (const profile of profiles) {
    if (profile.student_id) profileByStudent.set(profile.student_id, profile);
  }
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));

  const storedDobs =
    existingSetting?.[0]?.value && typeof existingSetting[0].value === "object"
      ? existingSetting[0].value
      : {};

  const records = [
    ...students.map((student, index) => ({
      kind: "student",
      index,
      record: student,
      usn: compact(student.usn),
      name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
      code: student.usn,
      profile: profileByStudent.get(student.id) ?? null,
    })),
    ...staff.map((person, index) => ({
      kind: "staff",
      index,
      record: person,
      usn: compact(person.employee_code),
      name: person.name,
      code: person.employee_code,
      profile: person.profile_id ? profileById.get(person.profile_id) ?? null : null,
    })),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    testEmails: TEST_EMAILS,
    students: [],
    staff: [],
    skipped: [],
  };
  const staffDobs = { ...storedDobs };

  let staffIndex = 0;
  for (let i = 0; i < records.length; i += 1) {
    const entry = records[i];
    const testEmail = TEST_EMAILS[i % TEST_EMAILS.length];
    const authEmail = String(entry.profile?.email ?? "").trim().toLowerCase();
    const authId = String(entry.profile?.id ?? "").trim();

    if (!entry.usn) {
      report.skipped.push({ kind: entry.kind, name: entry.name, reason: "no USN source" });
      continue;
    }
    if (!authEmail || !authId) {
      report.skipped.push({ kind: entry.kind, name: entry.name, reason: "no auth profile/email" });
      continue;
    }

    let dob;
    if (entry.kind === "student") {
      dob = String(entry.record.date_of_birth ?? "").slice(0, 10);
    } else {
      dob = staffDobs[entry.record.id] || testDob(staffIndex);
      staffDobs[entry.record.id] = dob;
      staffIndex += 1;
    }
    const password = ddmmDate(dob);
    if (!password) {
      report.skipped.push({ kind: entry.kind, name: entry.name, reason: `bad/missing DOB: ${dob || "empty"}` });
      continue;
    }

    const now = new Date().toISOString();
    const item = {
      kind: entry.kind,
      name: entry.name,
      code: entry.code,
      usn: entry.usn,
      email: testEmail,
      authEmail,
      dateOfBirth: dob,
      password,
      recordId: entry.record.id,
      authId,
    };

    if (!DRY) {
      const table = entry.kind === "student" ? "students" : "staff";
      await req(
        "PATCH",
        `/rest/v1/${table}?id=eq.${encodeURIComponent(entry.record.id)}`,
        { email: testEmail },
        "return=minimal"
      );

      await req(
        "PATCH",
        `/rest/v1/profiles?id=eq.${encodeURIComponent(authId)}`,
        { username: entry.usn },
        "return=minimal"
      );

      const credTable =
        entry.kind === "student" ? "student_credentials" : "staff_credentials";
      const key = entry.kind === "student" ? "student_id" : "staff_id";
      await req(
        "POST",
        `/rest/v1/${credTable}?on_conflict=${key}`,
        {
          [key]: entry.record.id,
          organisation_id: ORG_ID,
          username: entry.usn,
          password,
          email: authEmail,
          must_set_password: false,
          issued_at: now,
          username_chosen_at: now,
          last_rotated_at: now,
          revoked_at: null,
        },
        "return=minimal,resolution=merge-duplicates"
      );

      await req(
        "PUT",
        `/auth/v1/admin/users/${encodeURIComponent(authId)}`,
        { password }
      );

      await req(
        "DELETE",
        `/rest/v1/login_otp_codes?email=eq.${encodeURIComponent(authEmail)}`,
        undefined,
        "return=minimal"
      );
    }

    if (entry.kind === "student") report.students.push(item);
    else report.staff.push(item);
  }

  if (!DRY) {
    await req(
      "POST",
      "/rest/v1/settings?on_conflict=key",
      {
        id: `set-${SETTING_KEY}`,
        key: SETTING_KEY,
        value: staffDobs,
      },
      "return=minimal,resolution=merge-duplicates"
    );
  }

  fs.writeFileSync("/tmp/opencode/usn-logins.json", JSON.stringify(report, null, 2));

  console.log(DRY ? "DRY RUN" : "APPLIED");
  console.log(`students: ${report.students.length}, staff: ${report.staff.length}, skipped: ${report.skipped.length}`);
  console.log("\nStaff (USN / DOB / password / email):");
  for (const row of report.staff) {
    console.log(`${row.usn}  ${row.dateOfBirth}  ${row.password}  ${row.email}  ${row.name}`);
  }
  console.log("\nStudents (first 5):");
  for (const row of report.students.slice(0, 5)) {
    console.log(`${row.usn}  ${row.dateOfBirth}  ${row.password}  ${row.email}  ${row.name}`);
  }
  if (report.skipped.length) {
    console.log("\nSkipped:");
    for (const row of report.skipped) console.log(`${row.kind} ${row.name}: ${row.reason}`);
  }
  console.log("\nFull report: /tmp/opencode/usn-logins.json");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
