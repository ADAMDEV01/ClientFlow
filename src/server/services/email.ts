import "server-only";

type InvitationEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Send through Resend when configured. Returning false keeps local development
 * and deployments without email credentials usable through their manual invite URL.
 */
export async function sendInvitationEmail(input: InvitationEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;

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

  if (!response.ok) {
    // Do not include provider response bodies: they may contain recipient data.
    throw new Error("Invitation email delivery failed. Check the Resend configuration and sender verification.");
  }
  return true;
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
