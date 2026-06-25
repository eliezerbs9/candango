/**
 * Plain, dependency-free HTML templates for transactional email.
 * Each returns the subject + HTML + text body; the MailService wraps these
 * with recipient + sender and enqueues them for the worker to send via Brevo.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(heading: string, bodyHtml: string, cta: { label: string; href: string }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:18px;margin:0 0 8px;">Candango</h1>
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:24px;">
        <h2 style="font-size:16px;margin:0 0 12px;">${heading}</h2>
        ${bodyHtml}
        <p style="margin:24px 0 8px;">
          <a href="${cta.href}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:500;">${cta.label}</a>
        </p>
        <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">If the button doesn't work, copy this link into your browser:<br><a href="${cta.href}" style="color:#4f46e5;word-break:break-all;">${cta.href}</a></p>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;text-align:center;">Sent by Candango. If you didn't expect this email, you can ignore it.</p>
    </div>
  </body>
</html>`;
}

export function inviteEmail(p: { name?: string | null; orgName: string; link: string }): RenderedEmail {
  const who = p.name ? escape(p.name) : 'there';
  return {
    subject: `You've been invited to ${p.orgName} on Candango`,
    html: layout(
      `Join ${escape(p.orgName)} on Candango`,
      `<p style="margin:0;">Hi ${who}, you've been invited to join <strong>${escape(p.orgName)}</strong>. Click below to set your password and get started. This link expires in 7 days.</p>`,
      { label: 'Accept invite', href: p.link },
    ),
    text: `Hi ${p.name ?? 'there'}, you've been invited to join ${p.orgName} on Candango. Set your password here (expires in 7 days): ${p.link}`,
  };
}

export function passwordResetEmail(p: { name?: string | null; link: string }): RenderedEmail {
  const who = p.name ? escape(p.name) : 'there';
  return {
    subject: 'Reset your Candango password',
    html: layout(
      'Reset your password',
      `<p style="margin:0;">Hi ${who}, we received a request to reset your password. Click below to choose a new one. This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
      { label: 'Reset password', href: p.link },
    ),
    text: `Hi ${p.name ?? 'there'}, reset your Candango password here (expires in 1 hour): ${p.link}`,
  };
}

export function verifyEmail(p: { name?: string | null; link: string }): RenderedEmail {
  const who = p.name ? escape(p.name) : 'there';
  return {
    subject: 'Verify your email for Candango',
    html: layout(
      'Verify your email',
      `<p style="margin:0;">Hi ${who}, welcome to Candango! Please confirm your email address to secure your account. This link expires in 24 hours.</p>`,
      { label: 'Verify email', href: p.link },
    ),
    text: `Hi ${p.name ?? 'there'}, verify your Candango email here (expires in 24 hours): ${p.link}`,
  };
}

/** Notification sent to the support inbox when someone submits the website contact form. */
export function contactEmail(p: { name: string; email: string; message: string }): RenderedEmail {
  const name = escape(p.name);
  const email = escape(p.email);
  const message = escape(p.message);
  return {
    subject: `New contact message from ${p.name}`,
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:18px;margin:0 0 8px;">Candango — contact form</h1>
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:24px;">
        <p style="margin:0 0 4px;"><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:14px 0;">
        <p style="margin:0;white-space:pre-wrap;">${message}</p>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;text-align:center;">Reply directly to this email to respond to ${name}.</p>
    </div>
  </body>
</html>`,
    text: `New contact message from ${p.name} <${p.email}>\n\n${p.message}`,
  };
}
