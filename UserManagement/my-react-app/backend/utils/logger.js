const AuditLog = require("../models/AuditLog");

/**
 * Asynchronously records an activity or security event in the AuditLog collection.
 * Designed as non-blocking / fire-and-forget: failure to log never crashes the caller.
 *
 * @param {Object} entry
 * @param {string} entry.action - Action name e.g. "PRODUCT_STOCK_UPDATED", "COUPON_CREATED"
 * @param {string} [entry.category] - "INVENTORY", "DISCOUNT", "ORDER", "PAYMENT", "AUTH", "EMAIL"
 * @param {Object} [entry.actor] - { userId, email, role, ipAddress }
 * @param {Object} [entry.target] - { entityType, entityId, name }
 * @param {string} [entry.status] - "SUCCESS", "FAILURE", "WARNING", "INFO"
 * @param {Object} [entry.details] - Safe contextual metadata (never passwords or card details)
 */
async function logActivity({
  action,
  category = "SYSTEM",
  actor = {},
  target = {},
  status = "SUCCESS",
  details = {}
}) {
  try {
    // Sanitize any potential sensitive fields before logging
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.token;
    delete safeDetails.cardNumber;
    delete safeDetails.cvv;
    delete safeDetails.secret;

    await AuditLog.create({
      action,
      category,
      actor: {
        userId: actor.userId || actor.id || null,
        email: actor.email || "system",
        role: actor.role || "system",
        ipAddress: actor.ipAddress || null
      },
      target: {
        entityType: target.entityType || "",
        entityId: target.entityId ? target.entityId.toString() : "",
        name: target.name || ""
      },
      status,
      details: safeDetails
    });
  } catch (err) {
    // Non-blocking fallback warning; never disrupt primary API flows
    console.warn(`[AuditLog] Activity logging warning for action "${action}":`, err.message);
  }
}

module.exports = { logActivity };

