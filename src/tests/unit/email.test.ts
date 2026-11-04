import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { escapeHtml, getAppBaseUrl, sendInvitationEmail } from "@/server/services/email";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("invitation email delivery", () => {
  const email = {
    to: "person@example.com",
    subject: "Invitation",
    html: "<p>Invite</p>",
    text: "Invite",
  };

  it("returns false when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    global.fetch = vi.fn();
    await expect(sendInvitationEmail(email)).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns true when Resend accepts the email", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "ClientFlow <noreply@example.com>";
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await expect(sendInvitationEmail(email)).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
    }));
  });

  it("returns false on provider rejection so the manual link remains usable", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "ClientFlow <noreply@example.com>";
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(sendInvitationEmail(email)).resolves.toBe(false);
  });

  it("returns false on network errors", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "ClientFlow <noreply@example.com>";
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    await expect(sendInvitationEmail(email)).resolves.toBe(false);
  });

  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script a="b"> & 'x'`)).toBe("&lt;script a=&quot;b&quot;&gt; &amp; &#39;x&#39;");
  });
});

describe("application base URL validation", () => {
  it("uses the configured application origin and ignores a path", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://clientflow.example.com/path";
    delete process.env.AUTH_URL;
    expect(getAppBaseUrl()).toBe("https://clientflow.example.com");
  });

  it("falls back to AUTH_URL when NEXT_PUBLIC_APP_URL is empty", () => {
    process.env.NEXT_PUBLIC_APP_URL = " ";
    process.env.AUTH_URL = "https://auth.example.com";
    expect(getAppBaseUrl()).toBe("https://auth.example.com");
  });

  it("rejects malformed configured URLs with a clear message", () => {
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";
    expect(() => getAppBaseUrl()).toThrow(
      "Invalid NEXT_PUBLIC_APP_URL: expected an absolute http:// or https:// application URL.",
    );
  });

  it("rejects unsupported protocols", () => {
    process.env.NEXT_PUBLIC_APP_URL = "javascript:alert(1)";
    expect(() => getAppBaseUrl()).toThrow("Invalid NEXT_PUBLIC_APP_URL");
  });

  it("rejects URLs containing credentials", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://user:password@example.com";
    expect(() => getAppBaseUrl()).toThrow("without credentials");
  });

  it("uses VERCEL_URL when no explicit URL is configured", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.AUTH_URL;
    process.env.VERCEL_URL = "clientflow.example.com";
    expect(getAppBaseUrl()).toBe("https://clientflow.example.com");
  });

  it("fails clearly in production when no application URL is available", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.AUTH_URL;
    delete process.env.VERCEL_URL;
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getAppBaseUrl()).toThrow(
      "Missing application URL: set NEXT_PUBLIC_APP_URL or AUTH_URL in the production environment.",
    );
  });

  it("uses localhost in development when no URL is configured", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.AUTH_URL;
    delete process.env.VERCEL_URL;
    vi.stubEnv("NODE_ENV", "development");
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });
});
