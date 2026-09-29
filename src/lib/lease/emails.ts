import path from "path";
import { MailMessage } from "./ports";

interface SignedEmailInput {
  name: string;
  email: string;
  phone: string;
  signedAt: Date;
  landlordEmail: string;
  appUrl: string;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const formatTime = (at: Date) => at.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

// `documentFile` is the signed Lease Document Version's file, under public/.
export function tenantConfirmationEmail(input: SignedEmailInput & { documentFile: string }): MailMessage {
  const name = escapeHtml(input.name);
  const phone = escapeHtml(input.phone);
  return {
    from: `"No-Reply | Automated Lease System" <${input.landlordEmail}>`,
    to: input.email,
    subject: `[CONFIRMATION] Digital Lease Agreement - ${input.name}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: normal; letter-spacing: 1px;">SYSTEM NOTIFICATION</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear ${name},</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              This is an automated system confirmation that your digital signature has been successfully captured and securely applied to your lease agreement.
            </p>

            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #0f172a;">Digital Signature Record</p>
              <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px;">
                <li style="margin-bottom: 5px;"><strong>Signatory:</strong> ${name}</li>
                <li style="margin-bottom: 5px;"><strong>Contact:</strong> ${phone}</li>
                <li><strong>Timestamp:</strong> ${formatTime(input.signedAt)}</li>
              </ul>
            </div>

            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              A copy of the master lease agreement you signed is attached to this email for your records. Please keep this document safe.
            </p>
            <br/>
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">Sincerely,</p>
            <p style="color: #0f172a; font-weight: bold; font-size: 14px; margin-top: 5px;">Property Management</p>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0; text-transform: uppercase;">
              Please do not reply to this email. This inbox is not monitored.
            </p>
          </div>
        </div>
      `,
    attachments: [{ filename: "Lease_Agreement.pdf", path: path.join(process.cwd(), "public", input.documentFile) }],
  };
}

export function landlordNoticeEmail(input: SignedEmailInput): MailMessage {
  return {
    from: `"Lease Notifications" <${input.landlordEmail}>`,
    to: input.landlordEmail,
    subject: `New Lease Signed: ${input.name}`,
    html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2 style="color: #000;">New Lease Signature</h2>
          <p>A new lease agreement has just been signed and submitted.</p>
          <p><strong>Tenant Details:</strong></p>
          <ul>
            <li>Name: ${escapeHtml(input.name)}</li>
            <li>Email: ${escapeHtml(input.email)}</li>
            <li>Phone: ${escapeHtml(input.phone)}</li>
            <li>Time: ${formatTime(input.signedAt)}</li>
          </ul>
          <p>You can view their signature and details in your <a href="${input.appUrl}/dashboard/tenants">Admin Dashboard</a>.</p>
        </div>
      `,
  };
}
