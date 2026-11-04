import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { escapeHtml, getAppBaseUrl, sendInvitationEmail } from "@/server/services/email";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  global.fetch = originalFetch;
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

  it("uses the configured application origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://clientflow.example.com/path";
    expect(getAppBaseUrl()).toBe("https://clientflow.example.com");
  });
});
