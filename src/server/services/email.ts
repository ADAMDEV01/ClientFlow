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

function parseAppOrigin(value: string, variableName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Invalid ${variableName}: expected an absolute http:// or https:// application URL.`,
    );
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      `Invalid ${variableName}: expected an absolute http:// or https:// URL without credentials.`,
    );
  }

  return parsed.origin;
}

export function getAppBaseUrl(): string {
  const configured = [
    ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL],
    ["AUTH_URL", process.env.AUTH_URL],
  ] as const;

  const selected = configured.find(([, value]) => value?.trim());
  if (selected) {
    const [variableName, value] = selected;
    return parseAppOrigin(value!.trim(), variableName);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return parseAppOrigin(`https://${vercelUrl}`, "VERCEL_URL");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing application URL: set NEXT_PUBLIC_APP_URL or AUTH_URL in the production environment.",
    );
  }

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
