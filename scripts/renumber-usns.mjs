#!/usr/bin/env node
/**
 * One-off: put every pupil on the GGS#### USN, and move their sign-in name with
 * it.
 *
 * The school prints its student numbers as its initials and four digits:
 * GGS1001. Every pupil currently on the old `adm2627nnnn` form is renumbered in
 * register order, keeping the order they were enrolled in, and the number runs
 * on from the highest GGS number already in use so a second run changes
 * nothing.
 *
 * The USN is also the sign-in name, so `profiles.username` and
 * `student_credentials.username` are renamed with it — but only where they are
 * still the old USN. A pupil who chose a name of their own keeps it.
 *
 * The old values are written to a backup file before anything is touched, so
 * the rename can be undone record by record.
 *
 * Usage:
 *   node scripts/renumber-usns.mjs --dry-run
 *   node scripts/renumber-usns.mjs
 */

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!SERVICE_KEY) {
  console.error(
    "SUPABASE_SERVICE_KEY is not set. Export it before running this script; " +
      "a service key is never kept in the repository."
  );
  process.exit(1);
}
const ORG_ID = "2f6cbae9-ed79-45e3-819c-a8c80eee7a0f";
const PREFIX = "GGS";
const FIRST_NUMBER = 1001;
const DRY = process.argv.includes("--dry-run");

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function req(method, path_, body, prefer) {
  const res = await fetch(SUPABASE_URL + path_, {
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
    throw new Error(`${method} ${path_} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

/** The digits at the end of a GGS USN, or null when this is not one. */
function ggsNumber(usn) {
  const match = /^GGS(\d+)$/i.exec(String(usn ?? "").trim());
  return match ? Number.parseInt(match[1], 10) : null;
}

async function main() {
  const students = await req(
    "GET",
    `/rest/v1/students?select=id,usn,first_name,last_name&organisation_id=eq.${ORG_ID}&order=usn.asc&limit=5000`
  );

  const highest = students.reduce((max, s) => {
    const n = ggsNumber(s.usn);
    return n !== null && n > max ? n : max;
  }, FIRST_NUMBER - 1);

  const targets = students.filter(s => /^adm\d+$/i.test(String(s.usn ?? "").trim()));
  const mapping = targets.map((s, index) => ({
    studentId: s.id,
    name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
    oldUsn: String(s.usn),
    newUsn: `${PREFIX}${String(highest + index + 1).padStart(4, "0")}`,
  }));

  if (!mapping.length) {
    console.log("Nothing to renumber: no pupil is on the old adm######## form.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join("/tmp/opencode", `usn-renumber-${stamp}.json`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), org: ORG_ID, mapping }, null, 2)
  );

  console.log(`${DRY ? "DRY RUN" : "APPLIED"}: ${mapping.length} pupil(s)`);
  console.log(`first: ${mapping[0].oldUsn} -> ${mapping[0].newUsn}`);
  console.log(`last:  ${mapping[mapping.length - 1].oldUsn} -> ${mapping[mapping.length - 1].newUsn}`);
  console.log(`backup: ${backupPath}`);
  if (DRY) return;

  /* The pupil record first: the sign-in name is derived from it. */
  for (const row of mapping) {
    await req(
      "PATCH",
      `/rest/v1/students?id=eq.${encodeURIComponent(row.studentId)}`,
      { usn: row.newUsn },
      "return=minimal"
    );
  }

  /*
   * The two tables that hold the sign-in name. Read back rather than assumed:
   * `profiles.username` is the authority for what a typed name resolves to, and
   * a pupil who renamed themselves must not be dragged back onto their USN.
   */
  const ids = mapping.map(row => row.studentId);
  const [profiles, credentials] = await Promise.all([
    req(
      "GET",
      `/rest/v1/profiles?select=id,username,student_id&student_id=in.(${ids
        .map(encodeURIComponent)
        .join(",")})&limit=5000`
    ),
    req(
      "GET",
      `/rest/v1/student_credentials?select=student_id,username&student_id=in.(${ids
        .map(encodeURIComponent)
        .join(",")})&limit=5000`
    ),
  ]);

  const byId = new Map(mapping.map(row => [row.studentId, row]));
  const byOldUsn = new Map(mapping.map(row => [row.oldUsn.toLowerCase(), row]));
  let renamed = 0;
  let kept = 0;

  for (const profile of profiles) {
    const target = byId.get(String(profile.student_id));
    if (!target) continue;
    const current = String(profile.username ?? "");
    if (current.toLowerCase() !== target.oldUsn.toLowerCase()) {
      kept += 1;
      continue;
    }
    await req(
      "PATCH",
      `/rest/v1/profiles?id=eq.${encodeURIComponent(String(profile.id))}`,
      { username: target.newUsn.toLowerCase() },
      "return=minimal"
    );
    renamed += 1;
  }

  for (const credential of credentials) {
    const target = byId.get(String(credential.student_id));
    if (!target) continue;
    const current = String(credential.username ?? "");
    if (current.toLowerCase() !== target.oldUsn.toLowerCase()) {
      kept += 1;
      continue;
    }
    await req(
      "PATCH",
      `/rest/v1/student_credentials?student_id=eq.${encodeURIComponent(String(credential.student_id))}`,
      { username: target.newUsn.toLowerCase() },
      "return=minimal"
    );
    renamed += 1;
  }

  /*
   * Read the roll back and say what is actually there. A PATCH that matched
   * nothing still answers 204, so without this the only evidence of success
   * would be the requests we sent.
   */
  const after = await req(
    "GET",
    `/rest/v1/students?select=usn&organisation_id=eq.${ORG_ID}&order=usn.asc&limit=5000`
  );
  const usns = after.map(row => String(row.usn));
  const stillOld = usns.filter(usn => /^adm\d+$/i.test(usn)).length;
  const unique = new Set(usns.map(usn => usn.toLowerCase())).size;

  console.log(`sign-in names renamed: ${renamed}, left as chosen: ${kept}`);
  console.log(`USNs now: ${usns.length}, GGS${ggsNumber(usns[0]) ?? "?"} -> ${usns[usns.length - 1]}`);
  console.log(`still on the old form: ${stillOld}`);
  console.log(`unique USNs: ${unique === usns.length ? "yes" : "NO — duplicates present"}`);
  if (stillOld !== 0 || unique !== usns.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
