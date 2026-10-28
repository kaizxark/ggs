import { describe, expect, it } from "vitest";
import {
  RESET_SUBJECT,
  escapeHtml,
  resetEmailHtml,
  resetEmailText,
  safeResetUrl,
} from "./reset-email";

/**
 * The reset email is the one message a user is told to click, so these tests
 * treat it as an attack surface rather than as formatting. The two things that
 * matter: nothing someone else can type ends up rendered as markup, and the
 * link is always the tokenised verify URL rather than the bare app page.
 */

const URL_OK = "https://ggs-erp.vercel.app/auth/verify?token=abc123&type=recovery&redirect_to=%2Freset-password";

describe("escapeHtml", () => {
  it("neutralises markup in a recipient name", () => {
    // The name comes from a profile row an admin typed, and this email is
    // exactly where someone expects to be told to click something.
    expect(escapeHtml('<img src=x onerror="alert(1)">')).not.toContain("<img");
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("escapes quotes so an href cannot be broken out of", () => {
    expect(escapeHtml('a" onmouseover="x')).toBe("a&quot; onmouseover=&quot;x");
    expect(escapeHtml("a'b")).toBe("a&#39;b");
  });

  it("leaves ordinary names alone", () => {
    expect(escapeHtml("Rajesh Menon")).toBe("Rajesh Menon");
  });

  it("handles missing values without printing undefined", () => {
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(null)).toBe("");
  });
});

describe("safeResetUrl", () => {
  it("accepts http and https", () => {
    expect(safeResetUrl("https://ggs-erp.vercel.app/reset-password")).toContain(
      "ggs-erp.vercel.app"
    );
    expect(safeResetUrl("http://localhost:5173/reset-password")).toContain(
      "localhost"
    );
  });

  it("rejects javascript: and data: URLs", () => {
    // Without this the link target is a stored-XSS vector aimed at whoever has
    // just asked to reset their password.
    expect(safeResetUrl("javascript:alert(1)")).toBe("");
    expect(safeResetUrl("JavaScript:alert(1)")).toBe("");
    expect(safeResetUrl("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  it("rejects anything unparseable", () => {
    expect(safeResetUrl("")).toBe("");
    expect(safeResetUrl(undefined)).toBe("");
    expect(safeResetUrl("not a url")).toBe("");
  });
});

describe("resetEmailHtml", () => {
  it("puts the tokenised link in the button and the fallback", () => {
    // The plain-text fallback is not decoration: mail clients strip the button
    // often enough that leaving the URL out of one of them loses the email.
    const html = resetEmailHtml({ resetUrl: URL_OK });
    expect(html).toContain(escapeHtml(URL_OK));
    // Button and fallback must be the same target.
    const hrefs = html.match(/href="[^"]+"/g) ?? [];
    expect(hrefs.length).toBeGreaterThanOrEqual(2);
    for (const href of hrefs) {
      expect(href).toContain("token=abc123");
    }
  });

  it("greets the recipient by name when one is known", () => {
    expect(resetEmailHtml({ resetUrl: URL_OK, recipientName: "Rajesh" })).toContain(
      "Hello Rajesh,"
    );
  });

  it("still reads properly with no name", () => {
    const html = resetEmailHtml({ resetUrl: URL_OK });
    expect(html).toContain("Hello,");
  });

  it("escapes the name rather than rendering it", () => {
    const html = resetEmailHtml({
      resetUrl: URL_OK,
      recipientName: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("degrades to an apology instead of an empty link when the URL is unusable", () => {
    // A blank href would send someone to the site root and look like the reset
    // had silently done nothing.
    const html = resetEmailHtml({ resetUrl: "javascript:alert(1)" });
    expect(html).toContain("Password reset unavailable");
    expect(html).not.toContain('href=""');
  });

  it("states the one-time and expiry rules", () => {
    const html = resetEmailHtml({ resetUrl: URL_OK });
    expect(html).toContain("expires shortly and works only once");
    expect(html).toContain("ignore this email");
  });
});

describe("resetEmailText", () => {
  it("carries the full token URL", () => {
    expect(resetEmailText({ resetUrl: URL_OK })).toContain("token=abc123");
  });

  it("explains rather than leaving a blank line when the URL is unusable", () => {
    expect(resetEmailText({ resetUrl: "javascript:x" })).toContain(
      "ask an administrator"
    );
  });

  it("warns about unrequested resets", () => {
    expect(resetEmailText({ resetUrl: URL_OK })).toContain(
      "safely ignore this email"
    );
  });
});

describe("subject", () => {
  it("names the school so it is recognisable in an inbox", () => {
    expect(RESET_SUBJECT).toContain("Global Kids School");
    expect(RESET_SUBJECT).toMatch(/password/i);
  });
});
