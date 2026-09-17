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
      console.error("[mailer] resend REJECTED the send:", res.status, body);
      console.warn(`[mailer] falling back to console. Login code for ${email}: ${code}`);
      return { delivered: false, via: "resend", error: `${res.status}` };
    }
    return { delivered: true, via: "resend" };
  } catch (err) {
    console.error("[mailer] resend threw:", err);
    console.warn(`[mailer] falling back to console. Login code for ${email}: ${code}`);
    return { delivered: false, via: "resend", error: String(err) };
  }
}

/**
 * Invite a second guardian to set up their own account.
 *
 * Deliberately an invitation to sign in, not a link that grants anything: they
 * arrive at the front door and get their own code, so the account is theirs and
 * the consent they give is their own. Nothing in this email is a credential,
 * which is why it is safe if it is forwarded.
 */
export async function sendParentInvite(email: string, invitedBy: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const url = "https://events.nextgenkenya.com";

  if (!key) {
    console.warn(`\n[mailer] RESEND_API_KEY not set — not emailing.\n` +
      `[mailer] Would invite ${email} (added by ${invitedBy})\n`);
    return { delivered: false, via: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: `${invitedBy} added you on NextGen Swim`,
        text:
          `${invitedBy} has added you as a parent or guardian on the NextGen ` +
          `Swim portal.\n\n` +
          `To set up your own access, go to ${url} and sign in with this email ` +
          `address. We will send you a six-digit code — there is no password.\n\n` +
          `You will be asked to confirm which swimmers are yours and to agree to ` +
          `how the club uses their data. That agreement is yours to give, which ` +
          `is why you have your own account rather than sharing one.\n\n` +
          `If you were not expecting this, you can ignore this email. It does ` +
          `not give anyone access to anything.\n\n` +
          `NextGen Multi Sport Academy`,
        html:
          `<p><strong>${invitedBy}</strong> has added you as a parent or guardian ` +
          `on the NextGen Swim portal.</p>` +
          `<p><a href="${url}">Set up your access</a> — sign in with this email ` +
          `address and we will send you a six-digit code. There is no password.</p>` +
          `<p>You will be asked to confirm which swimmers are yours and to agree ` +
          `to how the club uses their data. That agreement is yours to give, which ` +
          `is why you have your own account rather than sharing one.</p>` +
          `<p style="color:#666;font-size:14px">If you were not expecting this you ` +
          `can ignore it — nothing in this email gives access to anything.</p>` +
          `<p style="color:#666;font-size:13px">NextGen Multi Sport Academy</p>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[mailer] resend REJECTED the invite:", res.status, body);
      return { delivered: false, via: "resend", error: `${res.status}` };
    }
    return { delivered: true, via: "resend" };
  } catch (err) {
    console.error("[mailer] resend threw on invite:", err);
    return { delivered: false, via: "resend", error: String(err) };
  }
}
