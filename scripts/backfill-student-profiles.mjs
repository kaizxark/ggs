#!/usr/bin/env node
/**
 * Fill the pupil profile fields that the ERP screens already render but the
 * seed data never populated, plus a realistic first pass of the optional
 * profile sections (health, activities, observations, communication, admission,
 * library and documents).
 *
 * Usage:
 *   node scripts/backfill-student-profiles.mjs
 *   DOCS=0 node scripts/backfill-student-profiles.mjs   # skip storage uploads
 */

import crypto from "node:crypto";

const SUPABASE_URL = "https://fmlwzxmjrecbtvgraqqm.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  "REDACTED-SUPABASE-SECRET-KEY";
const ORG_ID = "2f6cbae9-ed79-45e3-819c-a8c80eee7a0f";
const ADMIN_ID = "60ff6003-c0a4-438f-85df-2048b0e7b6c8";
const BUCKET = "student-documents";
const BASE = new Date("2026-10-24T00:00:00Z");
const WITH_DOCUMENTS = process.env.DOCS !== "0";

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

async function upsert(table, rows, conflict = "id") {
  for (let i = 0; i < rows.length; i += 250) {
    const chunk = rows.slice(i, i + 250);
    await req("POST", `/rest/v1/${table}?on_conflict=${conflict}`, {
      body: chunk,
      prefer: "return=minimal, resolution=merge-duplicates",
    });
  }
  console.log(`  ~ ${table}: ${rows.length} rows`);
}

const hash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const uuidFor = (value) => {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20
  )}-${h.slice(20, 32)}`;
};

function rngFor(value) {
  let a = parseInt(hash(value).slice(0, 8), 16) >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function weighted(rng, pairs) {
  const total = pairs.reduce((sum, pair) => sum + pair[1], 0);
  let r = rng() * total;
  for (const [value, weight] of pairs) {
    r -= weight;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

const iso = (date) => date.toISOString().slice(0, 10);
const stamp = (date) => date.toISOString();
const daysAfter = (date, days) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const daysBefore = (date, days) => daysAfter(date, -days);
const round1 = (n) => Math.round(n * 10) / 10;

function mobile10(rng) {
  const prefixes = [
    "9845", "9945", "9731", "9632", "9448", "9740", "9886", "8884",
    "8546", "9035", "9380", "9946", "8197", "9108", "8895", "7022",
    "6363", "7339", "8123", "9739", "9846", "9902", "9449", "8095",
  ];
  return pick(rng, prefixes) + String(int(rng, 0, 999999)).padStart(6, "0");
}

function normaliseMobile(value, rng) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 11 && /^[6-9]/.test(digits)) return digits.slice(0, 10);
  return mobile10(rng);
}

function avatarFor(name) {
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const palette = ["#2f6f68", "#7662bc", "#cf845a", "#3b82b4", "#e0b45c", "#7a5c3e"];
  const bg = palette[parseInt(hash(name).slice(0, 6), 16) % palette.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
    `<rect width="256" height="256" rx="128" fill="${bg}"/>` +
    `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="Arial,Helvetica,sans-serif" font-size="96" font-weight="700" ` +
    `fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const MOTHER_NAMES = new Set(
  [
    "Lakshmi", "Saroja", "Kausalya", "Radha", "Sridevi", "Anitha", "Shanthi",
    "Lalitha", "Padma", "Prema", "Vasanthi", "Chitra", "Rekha", "Sunitha",
    "Malathi", "Kavitha", "Suma", "Rama", "Savitri", "Gowri", "Bhavani",
    "Nandini", "Jayashree", "Shilpa", "Manjula", "Asha", "Beena", "Deepa",
    "Usha", "Vijaya", "Anandhi", "Sudha", "Rohini", "Sarala", "Vimala",
    "Bhagyavathi", "Fatema", "Shabana", "Nazneen", "Simran", "Gurpreet",
    "Jaswinder", "Kavya", "Priya", "Sangeetha", "Swathi", "Aishwarya",
    "Ananya", "Bhavana", "Chaitra", "Divya", "Eshwari", "Gayathri",
    "Harshini", "Indira", "Jagrathi", "Manasa", "Pallavi", "Raghavi",
    "Trupthi", "Vasudha", "Akshata", "Bhargavi", "Chandana", "Darshana",
    "Hemalatha", "Jyothi", "Keerthi", "Meghana", "Nithya", "Rakshitha",
    "Shruti", "Tejaswini", "Vaishnavi", "Yashaswini", "Amrutha", "Bindu",
    "Deepthi", "Girija", "Jyoti", "Latha", "Nirmala", "Poornima", "Savitha",
    "Thulasi", "Vanitha", "Aditi", "Bhavika", "Geetha",
  ].map((name) => name.toLowerCase())
);

function guardianRelationship(guardian) {
  const words = String(guardian.full_name ?? "").toLowerCase().split(/\s+/);
  if (words.some((word) => MOTHER_NAMES.has(word))) return "Mother";
  return "Father";
}

const OCCUPATIONS = {
  Mother: [
    ["Homemaker", 34], ["Teacher", 15], ["Nurse", 10], ["Government service", 8],
    ["Small business", 8], ["Farmer", 6], ["Bank employee", 5], ["Tailoring", 5],
    ["Anganwadi worker", 5], ["Other", 4],
  ],
  Father: [
    ["Farmer", 20], ["Small business", 18], ["Driver", 12], ["Government service", 10],
    ["Engineer", 8], ["Shop owner", 8], ["Teacher", 6], ["Bank employee", 6],
    ["Mechanic", 6], ["Other", 6],
  ],
};

const BLOOD_GROUPS = [
  ["O+", 37], ["B+", 32], ["A+", 22], ["AB+", 7],
  ["O-", 1], ["B-", 0.5], ["A-", 0.5], ["AB-", 0.5],
];
const NATIONALITIES = [["Indian", 97], ["Nepali", 2], ["Sri Lankan", 1]];
const TONGUES = [
  ["Kannada", 55], ["Telugu", 15], ["Tamil", 10], ["Hindi", 8],
  ["Urdu", 6], ["Malayalam", 3], ["Marathi", 2], ["Konkani", 1],
];
const RELIGIONS = [
  ["Hindu", 78], ["Muslim", 10], ["Christian", 8],
  ["Jain", 2], ["Sikh", 1], ["Buddhist", 1],
];

const ALLERGIES = [
  ["None known", 55], ["Dust and pollen", 15], ["Peanuts", 8],
  ["Penicillin", 5], ["Lactose intolerance", 7], ["Seasonal grass pollen", 10],
];
const CONDITIONS = [
  ["None", 55], ["Mild asthma", 12], ["Eczema", 8],
  ["Vision corrected with glasses", 15], ["Seasonal allergic rhinitis", 10],
];
const MEDICATIONS = [
  ["None", 70], ["Inhaler as needed", 10], ["Antihistamine during allergy season", 10],
  ["Prescribed topical cream", 6], ["Iron supplement", 4],
];
const ACCESSIBILITY = [
  ["None", 80], ["Prefers front-row seating", 8],
  ["Needs extra time for written work", 6], ["Uses spectacles in class", 6],
];
const DOCTORS = [
  "Dr. Anil Kumar", "Dr. Shwetha Rao", "Dr. Prakash Shetty",
  "Dr. Nasreen Begum", "Dr. Ramesh Babu", "Dr. Kavitha Nair",
];

const ACTIVITY_DEFS = [
  {
    name: "Football Academy",
    category: "sport",
    description: "After-school football training and inter-school fixtures.",
    coordinator: "Eklavya Deshmukh",
  },
  {
    name: "Basketball Club",
    category: "sport",
    description: "Weekly basketball practice and friendly matches.",
    coordinator: "Eklavya Deshmukh",
  },
  {
    name: "Music Ensemble",
    category: "cultural",
    description: "School choir and instrumental ensemble.",
    coordinator: "Farida Sheikh",
  },
  {
    name: "Bharatanatyam",
    category: "cultural",
    description: "Classical dance practice for school productions.",
    coordinator: "Shobha Nair",
  },
  {
    name: "Robotics Club",
    category: "academic",
    description: "Design, build and programme simple robots.",
    coordinator: "Divya Thomas",
  },
  {
    name: "Chess Club",
    category: "club",
    description: "Weekly chess practice and internal tournaments.",
    coordinator: "Anita Kulkarni",
  },
  {
    name: "Eco Club",
    category: "event",
    description: "Campus gardening, waste segregation and awareness drives.",
    coordinator: "Suresh Prabhu",
  },
  {
    name: "Debate Society",
    category: "club",
    description: "Public speaking, debate practice and inter-school events.",
    coordinator: "Shobha Nair",
  },
];

const BOOKS = [
  "The Jungle Book", "Matilda", "Charlotte's Web", "The Hobbit",
  "Wings of Fire", "The Blue Umbrella", "Malgudi Days", "The Little Prince",
  "The Secret Garden", "Panchatantra Tales", "A Brief History of Time",
  "The Diary of a Young Girl",
];

const INCIDENT_SUMMARIES = [
  ["Mild headache during class", "Rested in the sick room and returned to class", "minor"],
  ["Scraped knee during PE", "Cleaned and dressed the scrape; returned to class", "minor"],
  ["Stomach ache after lunch", "Given water and monitored for 30 minutes", "minor"],
  ["Minor nosebleed", "Pressure applied; bleeding stopped in a few minutes", "minor"],
  ["Seasonal cold and mild fever", "Parents informed and pickup arranged", "moderate"],
  ["Allergic rash after dust exposure", "Antihistamine administered with guardian consent", "moderate"],
];

const OBSERVATION_BODIES = [
  "Contributes regularly in class discussions and helps classmates during group work.",
  "Shows steady progress in Mathematics; needs to slow down on multi-step problems.",
  "Settled quickly after the term break and is engaging well with the new topics.",
  "Has been quiet in class this week; check in with the family if it continues.",
  "Reads confidently in English and is beginning to use more descriptive vocabulary.",
  "Works well in practical Science lessons and asks thoughtful questions.",
  "Needs a reminder to submit homework on time; the quality of work is good.",
  "Shows kindness to younger pupils during assembly and break time.",
];

const COMMUNICATION_SUBJECTS = [
  ["general", "Phone call with guardian", "Discussed the pupil's progress and daily routine."],
  ["meeting", "Parent-teacher meeting", "Reviewed term progress, attendance and next steps."],
  ["academic", "Academic progress update", "Shared subject-wise progress and support plan."],
  ["attendance", "Attendance follow-up", "Discussed recent absences and the plan to catch up."],
  ["fees", "Fee reminder", "Reminded the family about the next instalment."],
];

const ADMISSION_SCHOOLS = [
  "Little Angels School, Tumakuru",
  "Sri Siddaganga School, Tumakuru",
  "Vidya Vardhaka School, Tumakuru",
  "St. Mary's School, Tumakuru",
  "Home learning",
];

function makePdf(lines) {
  const escape = (value) =>
    String(value).replace(/[\\()]/g, (match) => `\\${match}`).replace(/[^\x20-\x7E]/g, " ");
  const content = lines
    .map((line, index) => `BT /F1 14 Tf 72 ${720 - index * 24} Td (${escape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function uploadDocument(student, docType, fileName, lines, uploadedBy) {
  const stampValue = "20261001T090000Z";
  const path = `${student.id}/${docType}__${stampValue}__${fileName}`;
  const pdf = makePdf(lines);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: pdf,
    }
  );
  if (!res.ok) {
    throw new Error(`storage upload ${path} -> ${res.status}: ${await res.text()}`);
  }
  return {
    path,
    fileName,
    size: pdf.byteLength,
    uploadedBy,
  };
}

async function main() {
  console.log("Loading current records…");
  const students = await req(
    "GET",
    `/rest/v1/students?select=*&organisation_id=eq.${ORG_ID}&order=usn`
  );
  const guardians = await req(
    "GET",
    `/rest/v1/guardians?select=*&organisation_id=eq.${ORG_ID}`
  );
  const links = await req(
    "GET",
    `/rest/v1/student_guardians?select=*&organisation_id=eq.${ORG_ID}`
  );
  const profiles = await req(
    "GET",
    `/rest/v1/profiles?select=id,email,role&organisation_id=eq.${ORG_ID}`
  );
  const staff = await req(
    "GET",
    `/rest/v1/staff?select=id,profile_id,name,department&organisation_id=eq.${ORG_ID}`
  );
  const classrooms = await req(
    "GET",
    `/rest/v1/classrooms?select=id,grade,section,class_teacher_id&organisation_id=eq.${ORG_ID}`
  );
  const enrollments = await req(
    "GET",
    `/rest/v1/enrollments?select=student_id,classroom_id,active&organisation_id=eq.${ORG_ID}&active=eq.true`
  );
  const years = await req(
    "GET",
    `/rest/v1/academic_years?select=id,name,is_current&organisation_id=eq.${ORG_ID}`
  );
  const routes = await req(
    "GET",
    `/rest/v1/transport_routes?select=*&organisation_id=eq.${ORG_ID}`
  );
  const allocations = await req(
    "GET",
    `/rest/v1/transport_allocations?select=*&organisation_id=eq.${ORG_ID}`
  );

  const guardianById = new Map(guardians.map((g) => [String(g.id), g]));
  const linkByStudent = new Map(links.map((l) => [String(l.student_id), l]));
  const profileByEmail = new Map(
    profiles
      .filter((p) => p.email)
      .map((p) => [String(p.email).toLowerCase(), p])
  );
  const staffByName = new Map(staff.map((s) => [String(s.name), s]));
  const staffById = new Map(staff.map((s) => [String(s.id), s]));
  const classroomById = new Map(classrooms.map((c) => [String(c.id), c]));
  const classroomByStudent = new Map();
  for (const enrollment of enrollments) {
    const room = classroomById.get(String(enrollment.classroom_id));
    if (room) classroomByStudent.set(String(enrollment.student_id), room);
  }
  const currentYear = years.find((y) => y.is_current === true) ?? years[0];
  const routeById = new Map(routes.map((r) => [String(r.id), r]));
  const librarian = staffByName.get("Gurpreet Singh") ?? staff[0];
  const principal = staffByName.get("Dr. Meera Iyer") ?? staff[0];
  const adminProfile = profiles.find((p) => String(p.id) === ADMIN_ID) ?? principal;

  console.log("Updating pupil identity and contact fields…");
  const studentRows = [];
  const healthRows = [];
  for (const student of students) {
    const rng = rngFor(`student:${student.id}`);
    const link = linkByStudent.get(String(student.id));
    const guardian = link ? guardianById.get(String(link.guardian_id)) : null;
    const name = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
    const address = {
      ...(student.address ?? {}),
      city:
        student.address?.city ??
        student.address?.area ??
        student.address?.taluk ??
        "Tumakuru",
    };
    const guardianPhone = normaliseMobile(guardian?.phone ?? student.guardian_phone, rng);
    const guardianAlternate = normaliseMobile(
      guardian?.alternate_phone,
      rngFor(`guardian-alt:${guardian?.id ?? student.id}`)
    );
    const studentPhone = normaliseMobile(student.phone, rng);
    const blood = weighted(rng, BLOOD_GROUPS);
    const aadhaar = String(1000 + (parseInt(hash(`aadhaar:${student.usn}`).slice(0, 6), 16) % 9000));
    const emergencyName = guardian?.full_name ?? student.guardian_name ?? "Guardian";
    const emergencyPhone = guardianAlternate || guardianPhone;
    const age = Math.max(
      5,
      Math.min(
        18,
        BASE.getUTCFullYear() -
          new Date(String(student.date_of_birth)).getUTCFullYear()
      )
    );

    studentRows.push({
      id: student.id,
      organisation_id: ORG_ID,
      usn: student.usn,
      first_name: student.first_name,
      last_name: student.last_name,
      status: student.status,
      joined_on: student.joined_on,
      address,
      phone: studentPhone,
      email:
        student.email ||
        `${String(student.first_name ?? "student").toLowerCase()}.${String(
          student.last_name ?? "gks"
        ).toLowerCase()}@gks.edu.in`,
      guardian_phone: guardianPhone,
      blood_group: blood,
      nationality: weighted(rng, NATIONALITIES),
      mother_tongue: weighted(rng, TONGUES),
      religion: weighted(rng, RELIGIONS),
      aadhaar_last4: aadhaar,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      photo_url: avatarFor(name),
      updated_at: stamp(BASE),
    });

    const teacher =
      classroomByStudent.get(String(student.id))?.class_teacher_id
        ? staffById.get(
            String(classroomByStudent.get(String(student.id)).class_teacher_id)
          )
        : null;
    const doctor = pick(rng, DOCTORS);
    const doctorRng = rngFor(`doctor:${student.id}`);
    const condition = weighted(rng, CONDITIONS);
    const accessibility = weighted(rng, ACCESSIBILITY);

    healthRows.push({
      id: uuidFor(`health:${student.id}`),
      organisation_id: ORG_ID,
      student_id: student.id,
      blood_group: blood,
      height_cm: round1(110 + (age - 6) * 6 + rng() * 8),
      weight_kg: round1(18 + (age - 6) * 3.2 + rng() * 6),
      allergies: weighted(rng, ALLERGIES),
      medical_conditions: condition,
      medications:
        condition === "Mild asthma"
          ? "Inhaler as needed"
          : weighted(rng, MEDICATIONS),
      emergency_instructions:
        "Contact the guardian immediately. Do not give medication without guardian consent.",
      accessibility_needs: accessibility,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      regular_doctor_name: doctor,
      regular_doctor_phone: mobile10(doctorRng),
      insurance_reference: `GKS-INS-${student.usn.slice(-4)}`,
      checked_at: stamp(daysBefore(BASE, 12)),
      checked_by: teacher?.profile_id ?? principal.profile_id ?? principal.id,
      updated_at: stamp(BASE),
    });
  }
  await upsert("students", studentRows, "id");
  await upsert("student_health_records", healthRows, "student_id");

  console.log("Updating guardian details…");
  const guardianRows = [];
  for (const guardian of guardians) {
    const rng = rngFor(`guardian:${guardian.id}`);
    const relationship = guardianRelationship(guardian);
    const link = links.find((l) => String(l.guardian_id) === String(guardian.id));
    const student = link
      ? students.find((s) => String(s.id) === String(link.student_id))
      : null;
    const address = {
      ...(student?.address ?? {}),
      city:
        student?.address?.city ??
        student?.address?.area ??
        student?.address?.taluk ??
        "Tumakuru",
    };
    const parentProfile = guardian.email
      ? profileByEmail.get(String(guardian.email).toLowerCase())
      : null;
    guardianRows.push({
      id: guardian.id,
      organisation_id: ORG_ID,
      full_name: guardian.full_name,
      relationship,
      gender: relationship === "Mother" ? "female" : "male",
      phone: normaliseMobile(guardian.phone, rng),
      alternate_phone: mobile10(rng),
      email: guardian.email,
      occupation: weighted(rng, OCCUPATIONS[relationship]),
      address,
      photo_url: avatarFor(guardian.full_name),
      national_id: `XXXX XXXX ${String(
        1000 + (parseInt(hash(`gid:${guardian.id}`).slice(0, 6), 16) % 9000)
      )}`,
      updated_at: stamp(BASE),
      _parentProfileId: parentProfile?.id ?? null,
    });
  }
  await upsert(
    "guardians",
    guardianRows.map(({ _parentProfileId, ...row }) => row),
    "id"
  );

  console.log("Updating guardian links and permissions…");
  const guardianByIdAfter = new Map(guardianRows.map((g) => [String(g.id), g]));
  const linkRows = links.map((link) => {
    const guardian = guardianByIdAfter.get(String(link.guardian_id));
    return {
      id: link.id,
      organisation_id: ORG_ID,
      student_id: link.student_id,
      guardian_id: link.guardian_id,
      relationship: guardian?.relationship ?? "Guardian",
      is_primary: true,
      is_emergency_contact: true,
      portal_profile_id: guardian?._parentProfileId ?? null,
      can_view_academics: true,
      can_view_attendance: true,
      can_view_fees: true,
      can_view_documents: true,
      can_view_health: true,
      can_receive_messages: true,
      updated_at: stamp(BASE),
    };
  });
  await upsert("student_guardians", linkRows, "id");

  console.log("Updating transport allocation details…");
  const routeTimes = {
    "RT-01": ["07:15", "16:10", 1500],
    "RT-02": ["07:00", "16:20", 1600],
    "RT-03": ["06:50", "16:30", 1800],
    "RT-04": ["06:40", "16:40", 1900],
  };
  const allocationRows = allocations.map((allocation) => {
    const rng = rngFor(`transport:${allocation.id}`);
    const route = routeById.get(String(allocation.route_id));
    const [pickup, drop, fare] = routeTimes[route?.code] ?? ["07:15", "16:15", 1500];
    const add = int(rng, 0, 8);
    return {
      id: allocation.id,
      organisation_id: ORG_ID,
      route_id: allocation.route_id,
      student_id: allocation.student_id,
      stop_name: allocation.stop_name ?? "Main Road",
      active: allocation.active !== false,
      pickup_time: pickup,
      drop_time: drop,
      is_authorized_pickup: rng() > 0.18,
      fare_amount: fare + add * 10,
      ended_on: allocation.ended_on ?? null,
    };
  });
  await upsert("transport_allocations", allocationRows, "id");

  console.log("Creating activities and participation…");
  const activityRows = ACTIVITY_DEFS.map((activity) => {
    const coordinator = staffByName.get(activity.coordinator) ?? staff[0];
    return {
      id: uuidFor(`activity:${activity.name}`),
      organisation_id: ORG_ID,
      name: activity.name,
      category: activity.category,
      description: activity.description,
      coordinator_id: coordinator?.profile_id ?? coordinator?.id ?? null,
      academic_year_id: currentYear?.id ?? null,
      active: true,
      updated_at: stamp(BASE),
    };
  });
  await upsert("activities", activityRows, "id");

  const participationRows = [];
  for (const student of students) {
    const rng = rngFor(`activities:${student.id}`);
    const shuffled = [...activityRows].sort(
      (a, b) =>
        parseInt(hash(`${student.id}:${a.id}`).slice(0, 8), 16) -
        parseInt(hash(`${student.id}:${b.id}`).slice(0, 8), 16)
    );
    const count = int(rng, 1, 3);
    for (let index = 0; index < count; index++) {
      const activity = shuffled[index];
      const completed = index === count - 1 && rng() > 0.55;
      const started = daysBefore(BASE, int(rng, 40, 180));
      const ended = completed ? daysAfter(started, int(rng, 30, 90)) : null;
      const awarded = rng() > 0.8;
      participationRows.push({
        id: uuidFor(`participation:${student.id}:${activity.id}`),
        organisation_id: ORG_ID,
        activity_id: activity.id,
        student_id: student.id,
        role: pick(rng, ["Member", "Team member", "Club member", "Captain", "Volunteer"]),
        participation: completed ? "completed" : "active",
        award: awarded
          ? pick(rng, ["Runners-up — inter-school tournament", "Best team player", "Participation certificate"])
          : null,
        achievement: awarded
          ? pick(rng, ["Represented the school at district level", "Led the team in the final round"])
          : null,
        certificate_ref: awarded
          ? `GKS/ACT/2026/${student.usn.slice(-4)}`
          : null,
        started_on: iso(started),
        ended_on: ended ? iso(ended) : null,
        remarks: null,
        updated_at: stamp(BASE),
      });
    }
  }
  await upsert("activity_participations", participationRows, "activity_id,student_id");

  console.log("Creating health incidents…");
  const incidentRows = students.map((student) => {
    const rng = rngFor(`incident:${student.id}`);
    const [summary, action, severity] = pick(rng, INCIDENT_SUMMARIES);
    const teacher =
      classroomByStudent.get(String(student.id))?.class_teacher_id
        ? staffById.get(
            String(classroomByStudent.get(String(student.id)).class_teacher_id)
          )
        : null;
    const when = daysBefore(BASE, int(rng, 10, 140));
    return {
      id: uuidFor(`incident:${student.id}:1`),
      organisation_id: ORG_ID,
      student_id: student.id,
      incident_date: iso(when),
      summary,
      action_taken: action,
      severity,
      attendance_impact: severity === "moderate" ? "Rest of the day" : null,
      notified_guardian: true,
      guardian_notified_at: stamp(when),
      recorded_by: teacher?.profile_id ?? principal.profile_id ?? principal.id,
    };
  });
  await upsert("student_health_incidents", incidentRows, "id");

  console.log("Creating observations…");
  const observationRows = [];
  for (const student of students) {
    const rng = rngFor(`observation:${student.id}`);
    const room = classroomByStudent.get(String(student.id));
    const teacher = room?.class_teacher_id ? staffById.get(String(room.class_teacher_id)) : null;
    for (let index = 0; index < 2; index++) {
      const observed = daysBefore(BASE, int(rng, 5, 100));
      const category = pick(rng, [
        "positive", "participation", "academic_support", "wellbeing",
      ]);
      observationRows.push({
        id: uuidFor(`observation:${student.id}:${index}`),
        organisation_id: ORG_ID,
        student_id: student.id,
        classroom_id: room?.id ?? null,
        author_id: teacher?.profile_id ?? principal.profile_id ?? principal.id,
        category,
        body: pick(rng, OBSERVATION_BODIES),
        classroom_participation: int(rng, 2, 5),
        support_needed: category === "academic_support",
        action_taken:
          category === "academic_support"
            ? pick(rng, ["Extra practice worksheet shared", "Seated with a peer mentor", "Small-group support in class"])
            : null,
        follow_up_on: category === "academic_support" ? iso(daysAfter(observed, 14)) : null,
        follow_up_done: category === "academic_support" ? rng() > 0.5 : false,
        follow_up_notes: null,
        visible_to_guardians: category !== "wellbeing" || rng() > 0.5,
        observed_on: iso(observed),
        updated_at: stamp(BASE),
      });
    }
  }
  await upsert("student_observations", observationRows, "id");

  console.log("Creating communication history…");
  const communicationRows = [];
  for (const student of students) {
    const rng = rngFor(`communication:${student.id}`);
    const link = linkByStudent.get(String(student.id));
    const room = classroomByStudent.get(String(student.id));
    const teacher = room?.class_teacher_id ? staffById.get(String(room.class_teacher_id)) : null;
    for (let index = 0; index < 2; index++) {
      const [kind, subject, notes] = pick(rng, COMMUNICATION_SUBJECTS);
      const occurred = daysBefore(BASE, int(rng, 3, 120));
      communicationRows.push({
        id: uuidFor(`communication:${student.id}:${index}`),
        organisation_id: ORG_ID,
        student_id: student.id,
        kind,
        message_id: null,
        guardian_id: link?.guardian_id ?? null,
        subject,
        notes:
          kind === "meeting"
            ? `${notes} Guardian attended the meeting in person.`
            : notes,
        outcome: pick(rng, [
          "Guardian acknowledged the update.",
          "Follow-up agreed for the next term.",
          "No further action needed.",
          "Guardian requested a written summary.",
        ]),
        occurred_at: stamp(occurred),
        acknowledged_at: rng() > 0.4 ? stamp(daysAfter(occurred, int(rng, 1, 5))) : null,
        recorded_by: teacher?.profile_id ?? principal.profile_id ?? principal.id,
        updated_at: stamp(BASE),
      });
    }
  }
  await upsert("student_communications", communicationRows, "id");

  console.log("Creating admission records…");
  const admissionRows = students.map((student) => {
    const rng = rngFor(`admission:${student.id}`);
    const room = classroomByStudent.get(String(student.id));
    const grade = Number(room?.grade ?? 6);
    const joined = new Date(String(student.joined_on));
    const inactive = String(student.status) !== "active";
    const withdrawn = inactive ? daysAfter(joined, int(rng, 120, 260)) : null;
    return {
      id: uuidFor(`admission:${student.id}`),
      organisation_id: ORG_ID,
      student_id: student.id,
      academic_year_id: currentYear?.id ?? null,
      application_date: iso(daysBefore(joined, 21)),
      status: inactive ? "withdrawn" : "approved",
      applied_on: iso(daysBefore(joined, 21)),
      admitted_on: iso(joined),
      previous_school: pick(rng, ADMISSION_SCHOOLS),
      previous_class: `Grade ${Math.max(1, grade - 1)}`,
      previous_board: pick(rng, ["Karnataka State Board", "CBSE", "ICSE"]),
      admission_type: grade === 6 ? "new" : pick(rng, ["new", "transfer"]),
      remarks: "Documents verified at admission. Emergency contacts confirmed.",
      withdrawn_on: withdrawn ? iso(withdrawn) : null,
      withdrawal_reason: withdrawn ? "Family relocated to another city." : null,
      graduated_on: null,
      updated_at: stamp(BASE),
    };
  });
  await upsert("admission_records", admissionRows, "id");

  console.log("Creating library loans…");
  const loanRows = [];
  for (const student of students) {
    const rng = rngFor(`library:${student.id}`);
    for (let index = 0; index < 2; index++) {
      const issued = daysBefore(BASE, int(rng, 10, 150));
      const due = daysAfter(issued, 14);
      const status = weighted(rng, [
        ["returned", 70], ["issued", 20], ["overdue", 10],
      ]);
      const returned =
        status === "returned" ? daysAfter(issued, int(rng, 4, 14)) : null;
      const overdue = status === "overdue";
      loanRows.push({
        id: uuidFor(`loan:${student.id}:${index}`),
        organisation_id: ORG_ID,
        student_id: student.id,
        book_title: pick(rng, BOOKS),
        book_isbn: `978${String(int(rng, 1000000000, 1999999999))}`,
        book_reference: `LIB-2026-${String(int(rng, 1000, 9999))}`,
        issued_on: iso(issued),
        due_on: iso(due),
        returned_on: returned ? iso(returned) : null,
        fine_amount: overdue ? pick(rng, [10, 20, 30]) : 0,
        status,
        issued_by: librarian?.profile_id ?? librarian?.id ?? null,
        notes: overdue ? "Reminder sent to the class teacher." : null,
        updated_at: stamp(BASE),
      });
    }
  }
  await upsert("library_loans", loanRows, "id");

  if (WITH_DOCUMENTS) {
    console.log("Uploading sample documents and metadata…");
    const documentRows = [];
    let uploaded = 0;
    for (const student of students) {
      const name = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
      const usn = String(student.usn ?? "");
      const documents = [
        {
          docType: "birth-certificate",
          fileName: "birth-certificate.pdf",
          category: "birth_certificate",
          title: "Birth certificate",
          lines: [
            "GLOBAL KIDS SCHOOL",
            "BIRTH CERTIFICATE (SCHOOL COPY)",
            `Name: ${name}`,
            `USN: ${usn}`,
            `Date of birth: ${student.date_of_birth ?? ""}`,
            "This is a sample record generated for the school ERP demo.",
          ],
        },
        {
          docType: "aadhaar",
          fileName: "aadhaar.pdf",
          category: "identity_document",
          title: "Aadhaar card (masked)",
          lines: [
            "GLOBAL KIDS SCHOOL",
            "IDENTITY DOCUMENT (MASKED COPY)",
            `Name: ${name}`,
            `USN: ${usn}`,
            "Aadhaar: XXXX XXXX XXXX",
            "This is a sample record generated for the school ERP demo.",
          ],
        },
        {
          docType: "marks-card",
          fileName: "marks-card.pdf",
          category: "other",
          title: "Marks card",
          lines: [
            "GLOBAL KIDS SCHOOL",
            "TERM MARKS CARD",
            `Name: ${name}`,
            `USN: ${usn}`,
            "First Term 2026-27",
            "This is a sample record generated for the school ERP demo.",
          ],
        },
        {
          docType: "hall-ticket",
          fileName: "hall-ticket.pdf",
          category: null,
          title: "Hall ticket",
          lines: [
            "GLOBAL KIDS SCHOOL",
            "EXAMINATION HALL TICKET",
            `Name: ${name}`,
            `USN: ${usn}`,
            "Mid-Term Examination 2026-27",
            "This is a sample record generated for the school ERP demo.",
          ],
        },
      ];

      for (const document of documents) {
        const result = await uploadDocument(
          student,
          document.docType,
          document.fileName,
          document.lines,
          adminProfile.id
        );
        uploaded += 1;
        if (!document.category) continue;
        documentRows.push({
          id: uuidFor(`document:${student.id}:${document.category}`),
          organisation_id: ORG_ID,
          student_id: student.id,
          category: document.category,
          title: document.title,
          file_path: result.path,
          file_name: result.fileName,
          content_type: "application/pdf",
          size_bytes: result.size,
          issued_on: "2026-10-01",
          uploaded_on: "2026-10-01",
          uploaded_by: adminProfile.id,
          verification_status: "verified",
          verified_by: adminProfile.id,
          verified_on: "2026-10-02",
          rejection_reason: null,
          remarks: "Sample document generated for the ERP demo.",
          expires_on: null,
          version: 1,
          supersedes_id: null,
          is_current: true,
          updated_at: stamp(BASE),
        });
      }
    }
    await upsert("student_documents", documentRows, "id");
    console.log(`  + storage: ${uploaded} files`);
  }

  console.log("\nBackfill complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
