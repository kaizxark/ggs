import { describe, expect, it } from "vitest";
import {
  BUCKET,
  DOC_TYPE_PATTERN,
  MAX_BYTES,
  STUDENT_ID_PATTERN,
  parseKey,
  safeFileName,
  stamp,
} from "./documents";

/**
 * There is no student_documents table in this project, so the object path is
 * the schema. These tests pin that grammar down, because a filename that
 * escapes its student prefix or a parser that misreads it would either lose a
 * file or expose one student's documents to another.
 */

describe("safeFileName", () => {
  it("keeps ordinary names readable", () => {
    expect(safeFileName("Aadhaar - Priya Menon.pdf")).toBe("Aadhaar-Priya-Menon.pdf");
    expect(safeFileName("marks_card_2026.pdf")).toBe("marks-card-2026.pdf");
    expect(safeFileName("Report Card (Term 1).pdf")).toBe("Report-Card-Term-1.pdf");
  });

  it("strips directory separators so a name cannot climb out", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd.exe");
    expect(safeFileName("/absolute/path.pdf")).toBe("path.pdf");
  });

  it("never emits the path separator", () => {
    for (const input of [
      "../../secret",
      "a/b/c.pdf",
      "..\\..\\x",
      "///etc/shadow",
    ]) {
      const out = safeFileName(input);
      expect(out.includes("/")).toBe(false);
      expect(out.includes("\\")).toBe(false);
    }
  });

  it("cannot produce the grammar marker, which is what keeps keys parseable", () => {
    // The key format splits on "__", so a filename containing it would make
    // parseKey misattribute the type and the issue date.
    for (const input of [
      "a__b__c.pdf",
      "__leading",
      "trailing__",
      "weird____name.pdf",
    ]) {
      expect(safeFileName(input)).not.toContain("__");
    }
  });

  it("strips leading dots so nothing becomes a hidden or relative name", () => {
    expect(safeFileName(".hidden.pdf")).toBe("hidden.pdf");
    expect(safeFileName("..")).toBe("document");
  });

  it("falls back rather than returning an empty segment", () => {
    expect(safeFileName("")).toBe("document");
    expect(safeFileName("   ")).toBe("document");
    expect(safeFileName("///")).toBe("document");
    expect(safeFileName("🎉🎉")).toBe("document");
  });

  it("bounds the length so a long name cannot dominate the key", () => {
    expect(safeFileName(`${"a".repeat(500)}.pdf`).length).toBeLessThanOrEqual(80);
  });
});

describe("stamp", () => {
  it("produces a sortable compact UTC stamp", () => {
    expect(stamp(new Date("2026-10-02T22:11:45.000Z"))).toBe("20261002T221145Z");
  });

  it("sorts chronologically as a string", () => {
    const older = stamp(new Date("2025-01-01T00:00:00Z"));
    const newer = stamp(new Date("2026-10-02T00:00:00Z"));
    expect(older.localeCompare(newer)).toBeLessThan(0);
  });
});

describe("parseKey", () => {
  it("recovers the type, issue date and original name", () => {
    expect(
      parseKey("aadhaar__20261002T221145Z__aadhaar-priya.pdf")
    ).toEqual({
      docType: "aadhaar",
      issuedAt: "20261002T221145Z",
      fileName: "aadhaar-priya.pdf",
    });
  });

  it("round-trips a name that itself contained punctuation", () => {
    const name = safeFileName("Report Card (Term 1).pdf");
    const key = `marks-card__20261002T221145Z__${name}`;
    expect(parseKey(key).fileName).toBe(name);
    expect(parseKey(key).docType).toBe("marks-card");
  });

  it("does not fall over on an object written without the convention", () => {
    // A file uploaded before this grammar existed, or a foreign object in the
    // prefix, must not throw — it should still show up in the list.
    const parsed = parseKey("mystery-file.pdf");
    expect(parsed.docType).toBe("mystery-file.pdf");
    expect(parsed.issuedAt).toBeNull();
    expect(parsed.fileName).toBe("mystery-file.pdf");
  });
});

describe("input validation", () => {
  it("accepts real student ids", () => {
    for (const id of [
      "19edc98d-6ddb-4290-9763-998a22c24bc1",
      "GKS-24081",
      "abc_123",
    ]) {
      expect(STUDENT_ID_PATTERN.test(id), id).toBe(true);
    }
  });

  it("rejects ids that could traverse or inject", () => {
    for (const id of [
      "../other-student",
      "a/b",
      "a?b",
      "a b",
      "a&select=*",
      "a,b",
      "",
      "x".repeat(200),
    ]) {
      expect(STUDENT_ID_PATTERN.test(id), id).toBe(false);
    }
  });

  it("accepts the eight document types and rejects anything else", () => {
    for (const id of [
      "aadhaar",
      "marks-card",
      "hall-ticket",
      "birth-certificate",
      "caste-income",
      "transfer-certificate",
      "immunisation",
      "passport",
    ]) {
      expect(DOC_TYPE_PATTERN.test(id), id).toBe(true);
    }
    expect(DOC_TYPE_PATTERN.test("../aadhaar")).toBe(false);
    expect(DOC_TYPE_PATTERN.test("Aadhaar")).toBe(false);
    expect(DOC_TYPE_PATTERN.test("a/b")).toBe(false);
    expect(DOC_TYPE_PATTERN.test("")).toBe(false);
  });

  it("caps uploads at 10 MB, matching the bucket", () => {
    expect(MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it("uses a private bucket name", () => {
    expect(BUCKET).toBe("student-documents");
  });
});