const Order = require("../models/Order");
const User = require("../models/User");
const { generateInvoicePDF } = require("./invoiceGenerator");
const sendEmail = require("./sendEmail");

/**
 * Concurrency-safe, idempotent invoice generation & order confirmation email delivery.
 * Guarantees that duplicate payment webhooks or concurrent requests will only ever:
 * 1. Assign one unique invoiceNumber
 * 2. Send one confirmation email
 *
 * @param {string} orderId - MongoDB ObjectId string
 * @returns {Promise<{ invoiceNumber: string, emailSent: boolean }>}
 */
async function processOrderInvoiceAndEmail(orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus !== "Paid") {
      return { invoiceNumber: null, emailSent: false, reason: "Order not found or not paid" };
    }

    // 1. Assign Invoice Number idempotently if not already assigned
    if (!order.invoiceNumber) {
      const year = new Date().getFullYear();
      const uniqueSuffix = order._id.toString().substring(18, 24).toUpperCase();
      const invoiceNum = `INV-${year}-${uniqueSuffix}`;

      // Atomic update to prevent race conditions during concurrent webhooks
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, invoiceNumber: { $exists: false } },
        {
          $set: {
            invoiceNumber: invoiceNum,
            invoiceGeneratedAt: new Date()
          }
        },
        { returnDocument: "after" }
      );

      if (updated) {
        order.invoiceNumber = updated.invoiceNumber;
        order.invoiceGeneratedAt = updated.invoiceGeneratedAt;
      }
    }

    // 2. Prevent Duplicate Emails (Idempotency Check)
    // Atomic test-and-set: only proceed if status is 'NotSent' or 'Failed'
    const lockClaimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
        invoiceEmailStatus: { $in: ["NotSent", "Failed"] }
      },
      {
        $set: { invoiceEmailStatus: "Sending" }
      },
      { returnDocument: "after" }
    );

    if (!lockClaimed) {
      // Email is already Sent or currently Sending in another thread
      return { invoiceNumber: order.invoiceNumber, emailSent: false, reason: "Email already sent or sending" };
    }

    // 3. Generate In-Memory PDF
    const user = await User.findById(order.userId).select("name email phone country");
    const pdfBuffer = await generateInvoicePDF(order, user);

    // 4. Send Confirmation Email with PDF Attachment
    const customerEmail = order.userEmail || user?.email;
    if (!customerEmail) {
      await Order.updateOne({ _id: order._id }, { invoiceEmailStatus: "Failed" });
      return { invoiceNumber: order.invoiceNumber, emailSent: false, reason: "No recipient email found" };
    }

    const itemsSummary = (order.products || [])
      .map(
        (p) =>
          `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
            <strong>${p.name}</strong> × ${p.quantity} — 
            <span style="color: #2563eb; font-weight: 600;">Rs. ${(p.price * p.quantity).toLocaleString("en-IN")}</span>
          </li>`
      )
      .join("");

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-bottom: 8px;">shopiee</h2>
        <h3 style="color: #1e293b; margin-top: 0;">Order Confirmed & Payment Received!</h3>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Hi <strong>${order.userName || user?.name || "Customer"}</strong>, thank you for your order! Your payment has been verified, and your order is now being processed.
        </p>

        <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Order ID:</strong> ${order._id}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Invoice Number:</strong> ${order.invoiceNumber}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Payment Method:</strong> ${order.paymentMethod || "Card"} (PAID)</p>
          <p style="margin: 0; font-size: 15px; font-weight: bold; color: #16a34a;"><strong>Total Amount Paid:</strong> Rs. ${Number(order.totalAmount).toLocaleString("en-IN")}</p>
        </div>

        <h4 style="color: #1e293b; margin-bottom: 10px;">Items Ordered:</h4>
        <ul style="list-style: none; padding: 0; margin: 0 0 24px 0;">
          ${itemsSummary}
        </ul>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          📎 <strong>Your official tax invoice is attached as a PDF to this email.</strong> You can also download it anytime directly from your Shopiee <em>My Orders</em> page.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Shopiee E-Commerce Platform • All rights reserved</p>
      </div>
    `;

    try {
      await sendEmail({
        to: customerEmail,
        subject: `Shopiee – Order Confirmation & Tax Invoice (${order.invoiceNumber})`,
        html: emailHtml,
        attachments: [
          {
            filename: `shopiee-invoice-${order.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf"
          }
        ]
      });

      // Update state to Sent only after mailer confirms acceptance
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            invoiceEmailStatus: "Sent",
            invoiceEmailSentAt: new Date()
          }
        }
      );

      return { invoiceNumber: order.invoiceNumber, emailSent: true };
    } catch (sendErr) {
      // Record failure without reverting the Paid order status
      await Order.updateOne(
        { _id: order._id },
        {
          $set: { invoiceEmailStatus: "Failed" }
        }
      );
      console.error(`[Invoice Service] Email delivery failed for order ${order._id}:`, sendErr.message);
      return { invoiceNumber: order.invoiceNumber, emailSent: false, error: sendErr.message };
    }
  } catch (err) {
    console.error("[Invoice Service] Unexpected error:", err.message);
    return { invoiceNumber: null, emailSent: false, error: err.message };
  }
}

module.exports = { processOrderInvoiceAndEmail };

