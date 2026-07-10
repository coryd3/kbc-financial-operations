export type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
};

let warnedAboutConfiguration = false;

export function appBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}

export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return true;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    if (!warnedAboutConfiguration) {
      warnedAboutConfiguration = true;
      console.warn("[email] Delivery is disabled. Set RESEND_API_KEY and EMAIL_FROM to send account email.");
    }
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${detail.slice(0, 500)}`);
  }
  return true;
}
