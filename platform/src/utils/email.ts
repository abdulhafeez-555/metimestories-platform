import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: `"Me Time Stories" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    html,
  });
}

export async function send2FACode(to: string, code: string, name: string) {
  await sendEmail(
    to,
    'Your Me Time Stories login code',
    `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
      <h2 style="color:#0F6E56;">Me Time Stories</h2>
      <p>Hi ${name},</p>
      <p>Your login verification code is:</p>
      <div style="background:#f5f5f5;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#0F6E56;">${code}</span>
      </div>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you did not request this, please ignore this email.</p>
      <p style="color:#999;font-size:12px;">Me Time Stories Ltd &mdash; Every child deserves to be the hero.</p>
    </div>`
  );
}

export function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
