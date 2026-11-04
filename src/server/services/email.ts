import "server-only";

type InvitationEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Send through Resend when configured. Delivery failures deliberately fall
 * back to the one-time invitation URL so an already-created invitation is
 * never stranded because an external mail provider is unavailable.
 */
export async function sendInvitationEmail(input: InvitationEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    // Do not leak provider response bodies or recipient data into logs/errors.
    return false;
  }
}

export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
