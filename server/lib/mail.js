import nodemailer from 'nodemailer';

const ROLE_LABELS = {
  admin: 'Administrator',
  user: 'Korisnik',
  viewer: 'Pregledač',
};

let transporter;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim());
}

export async function sendInviteEmail({ to, inviteUrl, role, inviterName }) {
  const transport = getTransporter();
  if (!transport) {
    return {
      sent: false,
      reason:
        'SMTP nije podešen. U server/.env dodajte SMTP_HOST, SMTP_USER, SMTP_PASS (vidi .env.example).',
    };
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (!from) {
    return { sent: false, reason: 'MAIL_FROM ili SMTP_USER mora biti podešen.' };
  }

  const roleLabel = ROLE_LABELS[role] || role;
  const appName = process.env.APP_NAME || 'Home Sorter';

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#1e293b;max-width:520px">
      <h2 style="color:#2563eb">${appName} — pozivnica</h2>
      <p>${inviterName ? `<strong>${inviterName}</strong> vas poziva` : 'Pozvani ste'} da se pridružite aplikaciji kao <strong>${roleLabel}</strong>.</p>
      <p>Kliknite na dugme ispod da postavite lozinku i aktivirate nalog (link važi 7 dana):</p>
      <p style="margin:24px 0">
        <a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
          Prihvati pozivnicu
        </a>
      </p>
      <p style="font-size:12px;color:#64748b">Ako dugme ne radi, kopirajte link:<br><a href="${inviteUrl}">${inviteUrl}</a></p>
    </div>
  `.trim();

  try {
    await transport.sendMail({
      from,
      to,
      subject: `${appName} — pozivnica za pristup`,
      text: `Pozvani ste u ${appName} (${roleLabel}). Otvorite link: ${inviteUrl}`,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('sendInviteEmail:', err);
    return { sent: false, reason: err.message || 'Slanje emaila nije uspelo' };
  }
}
