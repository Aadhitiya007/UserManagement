const nodemailer = require("nodemailer");
const { logActivity } = require("./logger");

/**
 * Reusable, production-grade email delivery service.
 * Supports production SMTP via environment variables and falls back to Ethereal in development.
 * Safely accepts optional email attachments (e.g. PDF invoices).
 * Automatically logs email success/failure events to the centralized AuditLog.
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const isProduction = process.env.NODE_ENV === "production";
  let transporter;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const cleanPass = process.env.EMAIL_PASS.replace(/\s+/g, "").trim();
    const cleanUser = process.env.EMAIL_USER.trim();
    const isGmail = process.env.EMAIL_HOST.toLowerCase().includes("gmail");
    const port = parseInt(process.env.EMAIL_PORT, 10) || (isGmail ? 465 : 587);
    const isSecure = port === 465;

    if (isGmail) {
      // Use Nodemailer's built-in Gmail service to bypass cloud port-blocking & STARTTLS issues on Render
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: cleanUser,
          pass: cleanPass
        }
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: port,
        secure: isSecure,
        auth: {
          user: cleanUser,
          pass: cleanPass
        },
        tls: {
          rejectUnauthorized: isProduction
        }
      });
    }
  } else if (!isProduction) {
    // Development fallback: automatic Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } else {
    throw new Error("Production email configuration missing: EMAIL_HOST, EMAIL_USER, and EMAIL_PASS are required.");
  }

  // Ensure valid RFC 5322 format: "Name" <email@example.com>
  let fromAddress = (process.env.EMAIL_FROM || "").trim();
  if (!fromAddress) {
    fromAddress = `"Shopiee Security" <${process.env.EMAIL_USER || "no-reply@shopiee.com"}>`;
  } else if (!fromAddress.includes("<") && fromAddress.includes("@")) {
    const parts = fromAddress.split(/\s+/);
    const emailPart = parts.pop().replace(/[<>]/g, "");
    const namePart = parts.join(" ").replace(/["']/g, "").trim();
    fromAddress = namePart ? `"${namePart}" <${emailPart}>` : emailPart;
  }

  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text: text || html.replace(/<[^>]+>/g, ""),
    html,
    attachments
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    // Non-blocking Audit Log recording
    logActivity({
      action: "EMAIL_SENT",
      category: "EMAIL",
      actor: { email: fromAddress, role: "system" },
      target: { entityType: "Email", name: to },
      status: "SUCCESS",
      details: {
        to,
        subject,
        messageId: info.messageId,
        attachmentCount: Array.isArray(attachments) ? attachments.length : 0
      }
    }).catch(() => {});

    // Only log preview URLs in local development when using Ethereal
    if (!isProduction && nodemailer.getTestMessageUrl(info)) {
      console.log(`[Email Service] Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (err) {
    // Non-blocking Audit Log recording
    logActivity({
      action: "EMAIL_FAILED",
      category: "EMAIL",
      actor: { email: fromAddress, role: "system" },
      target: { entityType: "Email", name: to },
      status: "FAILURE",
      details: {
        to,
        subject,
        error: err.message
      }
    }).catch(() => {});

    throw err;
  }
}

module.exports = sendEmail;
