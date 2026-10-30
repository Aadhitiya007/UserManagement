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
    const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const isSecure = port === 465;

    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: port,
      secure: isSecure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: isProduction
      }
    });
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

  const fromAddress = process.env.EMAIL_FROM || `"Shopiee Orders" <no-reply@shopiee.com>`;

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
