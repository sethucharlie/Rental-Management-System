import nodemailer from "nodemailer";
import { Mailer } from "./ports";

export function createGmailMailer(user: string, appPassword: string): Mailer {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: user.trim(),
      pass: appPassword.replace(/\s+/g, ""), // Gmail shows App Passwords with spaces
    },
  });

  return {
    async send(message) {
      await transporter.sendMail(message);
    },
  };
}
