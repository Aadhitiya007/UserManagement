const PDFDocument = require("pdfkit");

/**
 * Generates an in-memory PDF invoice Buffer for a verified paid order.
 * Handles clean multi-page pagination, professional branding, product line items, and totals.
 *
 * @param {Object} order - Full order document from MongoDB
 * @param {Object} user - User document containing phone, country, etc. (optional)
 * @returns {Promise<Buffer>}
 */
function generateInvoicePDF(order, user = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        bufferPages: true
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#2563eb";
      const textColor = "#1e293b";
      const lightGray = "#64748b";
      const borderColor = "#e2e8f0";

      // ----------------------------------------------------
      // 1. Header & Brand
      // ----------------------------------------------------
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("shopiee", 50, 45);

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(lightGray)
        .text("E-Commerce Platform & Retail Solutions", 50, 72)
        .text("Support: support@shopiee.com | www.shopiee.com", 50, 84);

      // Invoice Title & Status Badge
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .fillColor(textColor)
        .text("TAX INVOICE", 380, 45, { align: "right" });

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#16a34a")
        .text("[ PAID ]", 380, 72, { align: "right" });

      // Horizontal Divider
      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(50, 105)
        .lineTo(545, 105)
        .stroke();

      // ----------------------------------------------------
      // 2. Invoice & Customer Meta
      // ----------------------------------------------------
      const invoiceNumber = order.invoiceNumber || `INV-${order._id.toString().substring(18, 24).toUpperCase()}`;
      const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
      const paymentDate = order.paymentDetails?.paidAt
        ? new Date(order.paymentDetails.paidAt).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric"
          })
        : orderDate;

      // Left Column: Bill To
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor(textColor)
        .text("BILLED TO:", 50, 120);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(textColor)
        .text(order.userName || user?.name || "Customer", 50, 135)
        .fillColor(lightGray)
        .text(order.userEmail || user?.email || "customer@example.com", 50, 148);

      if (user?.phone) {
        doc.text(`Phone: ${user.phone}`, 50, 161);
      }
      if (user?.country) {
        doc.text(`Region: ${user.country}`, 50, user?.phone ? 174 : 161);
      }

      // Right Column: Invoice Details
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor(textColor)
        .text("INVOICE DETAILS:", 340, 120);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(lightGray)
        .text("Invoice Number:", 340, 135)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(invoiceNumber, 430, 135, { align: "right" })
        .font("Helvetica")
        .fillColor(lightGray)
        .text("Order ID:", 340, 148)
        .fillColor(textColor)
        .text(order._id.toString(), 430, 148, { align: "right" })
        .fillColor(lightGray)
        .text("Invoice Date:", 340, 161)
        .fillColor(textColor)
        .text(paymentDate, 430, 161, { align: "right" })
        .fillColor(lightGray)
        .text("Payment Method:", 340, 174)
        .fillColor(textColor)
        .text(order.paymentMethod || "Card", 430, 174, { align: "right" });

      if (order.paymentDetails?.transactionId) {
        doc
          .fillColor(lightGray)
          .text("Transaction ID:", 340, 187)
          .fillColor(textColor)
          .text(order.paymentDetails.transactionId, 430, 187, { align: "right" });
      }

      // ----------------------------------------------------
      // 3. Line Items Table
      // ----------------------------------------------------
      let currentY = 220;

      // Table Header Background
      doc
        .rect(50, currentY, 495, 22)
        .fill("#f8fafc");

      // Table Header Text
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(textColor)
        .text("ITEM DESCRIPTION", 60, currentY + 6)
        .text("QTY", 330, currentY + 6, { width: 40, align: "center" })
        .text("UNIT PRICE (INR)", 380, currentY + 6, { width: 75, align: "right" })
        .text("TOTAL (INR)", 465, currentY + 6, { width: 70, align: "right" });

      currentY += 25;

      const items = Array.isArray(order.products) ? order.products : [];

      items.forEach((item, index) => {
        // Page break check if near bottom margin
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        const itemName = item.name || "Product";
        const qty = item.quantity || 1;
        const price = Number(item.price) || 0;
        const lineTotal = price * qty;

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(textColor)
          .text(`${index + 1}. ${itemName}`, 60, currentY, { width: 260 })
          .text(qty.toString(), 330, currentY, { width: 40, align: "center" })
          .text(`Rs. ${price.toLocaleString("en-IN")}`, 380, currentY, { width: 75, align: "right" })
          .font("Helvetica-Bold")
          .text(`Rs. ${lineTotal.toLocaleString("en-IN")}`, 465, currentY, { width: 70, align: "right" });

        currentY += 24;

        // Subtle row line
        doc
          .strokeColor(borderColor)
          .lineWidth(0.5)
          .moveTo(50, currentY - 4)
          .lineTo(545, currentY - 4)
          .stroke();
      });

      // ----------------------------------------------------
      // 4. Financial Summary Breakdown
      // ----------------------------------------------------
      currentY += 10;
      if (currentY > 680) {
        doc.addPage();
        currentY = 50;
      }

      const totalAmount = Number(order.totalAmount) || 0;
      // Authoritative subtotal calculation
      const subtotal = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (it.quantity || 1), 0);
      const deliveryFee = 0; // Standard free delivery

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(lightGray)
        .text("Subtotal:", 350, currentY)
        .fillColor(textColor)
        .text(`Rs. ${subtotal.toLocaleString("en-IN")}`, 450, currentY, { align: "right" });

      currentY += 16;
      doc
        .fillColor(lightGray)
        .text("Shipping / Delivery:", 350, currentY)
        .fillColor("#16a34a")
        .text("FREE", 450, currentY, { align: "right" });

      currentY += 20;

      // Grand Total Box
      doc
        .rect(340, currentY, 205, 30)
        .fill("#f1f5f9");

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(textColor)
        .text("Total Paid:", 350, currentY + 8)
        .fillColor(primaryColor)
        .fontSize(12)
        .text(`Rs. ${totalAmount.toLocaleString("en-IN")}`, 440, currentY + 7, { align: "right" });

      // ----------------------------------------------------
      // 5. Footer & Legal Terms
      // ----------------------------------------------------
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);

        doc
          .strokeColor(borderColor)
          .lineWidth(1)
          .moveTo(50, 770)
          .lineTo(545, 770)
          .stroke();

        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(lightGray)
          .text(
            "This is a computer-generated invoice. No signature required. 7-Day standard replacement policy applies.",
            50,
            780,
            { align: "center", width: 495 }
          )
          .text(`Page ${i + 1} of ${pageCount}`, 50, 792, { align: "center", width: 495 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDF };

