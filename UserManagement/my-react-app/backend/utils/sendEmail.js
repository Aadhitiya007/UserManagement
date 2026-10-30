const nodemailer = require("nodemailer");

/**
 * Reusable, production-grade email delivery service.
 * Supports production SMTP via environment variables and falls back to Ethereal in development.
 * Safely accepts optional email attachments (e.g. PDF invoices).
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

  const info = await transporter.sendMail(mailOptions);

  // Only log preview URLs in local development when using Ethereal
  if (!isProduction && nodemailer.getTestMessageUrl(info)) {
    console.log(`[Email Service] Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }

  return info;
}

module.exports = sendEmail;
