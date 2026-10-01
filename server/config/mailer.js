import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  }

  return transporter;
}

async function sendMail({ toEmail, subject, text, html, fallbackLabel, fallbackValue }) {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.log(`[mailer] SMTP not configured; ${fallbackLabel} for ${toEmail}: ${fallbackValue}`);
    return;
  }

  await activeTransporter.sendMail({
    from: process.env.MAIL_FROM || 'StockIt <no-reply@stockit.local>',
    to: toEmail,
    subject,
    text,
    html,
  });
}

function otpHtml(introText, otp, expiryText) {
  return `<p>${introText}</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;">${otp}</p><p>This code expires in ${expiryText}.</p>`;
}

export async function sendPasswordResetEmail(toEmail, otp) {
  await sendMail({
    toEmail,
    subject: 'Your StockIt password reset code',
    text: `We received a request to reset your StockIt password. Your reset code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, you can safely ignore this email.`,
    html: otpHtml('We received a request to reset your StockIt password. Your reset code is:', otp, '10 minutes') + '<p>If you did not request this, you can safely ignore this email.</p>',
    fallbackLabel: 'password reset code',
    fallbackValue: otp,
  });
}

export async function sendVerificationEmail(toEmail, otp) {
  await sendMail({
    toEmail,
    subject: 'Your StockIt verification code',
    text: `Welcome to StockIt! Your verification code is ${otp}. It expires in 30 minutes.\n\nIf you did not create this account, you can safely ignore this email.`,
    html: otpHtml('Welcome to StockIt! Your verification code is:', otp, '30 minutes') + '<p>If you did not create this account, you can safely ignore this email.</p>',
    fallbackLabel: 'verification code',
    fallbackValue: otp,
  });
}
