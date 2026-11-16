import { describe, it, expect } from "vitest";
import {
  DEFAULT_FEE_STRUCTURE,
  COHORT_BANDS,
  parseGradeNumber,
  getFeeForGrade,
  getCohortBand,
  formatFeeInr,
} from "./fee-structure";

describe("Fee Structure Policy", () => {
  it("enforces default school fees policy: 30k for 1-4, 35k for 5-7, 40k for 8-10", () => {
    // Classes 1, 2, 3, 4: 30,000
    expect(DEFAULT_FEE_STRUCTURE[1]).toBe(30000);
    expect(DEFAULT_FEE_STRUCTURE[2]).toBe(30000);
    expect(DEFAULT_FEE_STRUCTURE[3]).toBe(30000);
    expect(DEFAULT_FEE_STRUCTURE[4]).toBe(30000);

    // Classes 5, 6, 7: 35,000
    expect(DEFAULT_FEE_STRUCTURE[5]).toBe(35000);
    expect(DEFAULT_FEE_STRUCTURE[6]).toBe(35000);
    expect(DEFAULT_FEE_STRUCTURE[7]).toBe(35000);

    // Classes 8, 9, 10: 40,000
    expect(DEFAULT_FEE_STRUCTURE[8]).toBe(40000);
    expect(DEFAULT_FEE_STRUCTURE[9]).toBe(40000);
    expect(DEFAULT_FEE_STRUCTURE[10]).toBe(40000);
  });

  it("extracts grade numbers properly with parseGradeNumber", () => {
    expect(parseGradeNumber("Grade 1")).toBe(1);
    expect(parseGradeNumber("Grade 4")).toBe(4);
    expect(parseGradeNumber("Class 5")).toBe(5);
    expect(parseGradeNumber("Class 7")).toBe(7);
    expect(parseGradeNumber("Grade 10")).toBe(10);
    expect(parseGradeNumber(6)).toBe(6);
    expect(parseGradeNumber("unassigned")).toBeNull();
    expect(parseGradeNumber(null)).toBeNull();
  });

  it("calculates annual fee for grade strings and numbers", () => {
    expect(getFeeForGrade("Grade 1")).toBe(30000);
    expect(getFeeForGrade("Grade 2")).toBe(30000);
    expect(getFeeForGrade("Grade 3")).toBe(30000);
    expect(getFeeForGrade("Grade 4")).toBe(30000);

    expect(getFeeForGrade("Grade 5")).toBe(35000);
    expect(getFeeForGrade("Grade 6")).toBe(35000);
    expect(getFeeForGrade("Grade 7")).toBe(35000);

    expect(getFeeForGrade("Grade 8")).toBe(40000);
    expect(getFeeForGrade("Grade 9")).toBe(40000);
    expect(getFeeForGrade("Grade 10")).toBe(40000);
  });

  it("supports custom fee structure overrides", () => {
    const custom = {
      ...DEFAULT_FEE_STRUCTURE,
      1: 32000,
      10: 45000,
    };
    expect(getFeeForGrade("Grade 1", custom)).toBe(32000);
    expect(getFeeForGrade("Grade 2", custom)).toBe(30000);
    expect(getFeeForGrade("Grade 10", custom)).toBe(45000);
  });

  it("maps grades to their respective cohort bands", () => {
    expect(getCohortBand(1).id).toBe("primary");
    expect(getCohortBand(4).id).toBe("primary");
    expect(getCohortBand(5).id).toBe("middle");
    expect(getCohortBand(7).id).toBe("middle");
    expect(getCohortBand(8).id).toBe("secondary");
    expect(getCohortBand(10).id).toBe("secondary");
  });

  it("formats fee currency correctly", () => {
    expect(formatFeeInr(30000)).toBe("₹30,000");
    expect(formatFeeInr(35000)).toBe("₹35,000");
    expect(formatFeeInr(40000)).toBe("₹40,000");
  });
});
