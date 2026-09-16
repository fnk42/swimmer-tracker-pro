// SERVER ONLY. Sends the one-time login code.
//
// If RESEND_API_KEY is absent the code is logged to the server console instead
// of being emailed. That keeps local development working with no third-party
// account, and it is deliberately loud so a misconfigured production deploy is
// obvious rather than silently failing to log anyone in.
const FROM = process.env.MAIL_FROM ?? "NextGen Swim <onboarding@resend.dev>";

export type SendResult = { delivered: boolean; via: "resend" | "console"; error?: string };

export async function sendLoginCode(email: string, code: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.warn(
      `\n[mailer] RESEND_API_KEY not set — not emailing.\n` +
        `[mailer] Login code for ${email}: ${code}\n`,
    );
    return { delivered: false, via: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: `${code} is your NextGen Swim sign-in code`,
        text:
          `Your sign-in code is ${code}\n\n` +
          `It expires in 10 minutes and can only be used once.\n\n` +
          `If you did not ask to sign in, you can ignore this email — ` +
          `nobody can get in without the code.\n\n` +
          `NextGen Swim Club — Swimming Nationals, Machakos, 19–22 November 2026`,
        html:
          `<p>Your sign-in code is</p>` +
          `<p style="font:700 32px/1.2 system-ui,sans-serif;letter-spacing:5px">${code}</p>` +
          `<p>It expires in 10 minutes and can only be used once.</p>` +
          `<p style="color:#666;font-size:14px">If you did not ask to sign in you can ignore ` +
          `this email — nobody can get in without the code.</p>` +
          `<p style="color:#666;font-size:13px">NextGen Swim Club — Swimming Nationals, ` +
          `Machakos, 19–22 November 2026</p>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[mailer] resend failed:", res.status, body);
      return { delivered: false, via: "resend", error: `${res.status}` };
    }
    return { delivered: true, via: "resend" };
  } catch (err) {
    console.error("[mailer] resend threw:", err);
    return { delivered: false, via: "resend", error: String(err) };
  }
}
