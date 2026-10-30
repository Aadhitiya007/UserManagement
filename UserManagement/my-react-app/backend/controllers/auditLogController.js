const AuditLog = require("../models/AuditLog");

/**
 * Get system audit logs with filtering and pagination (Admin only)
 * GET /api/admin/logs
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 25 } = req.query;

    const query = {};

    if (category && category !== "ALL") {
      query.category = category;
    }

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (search) {
      const sanitized = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitized, "i");
      query.$or = [
        { action: searchRegex },
        { "actor.email": searchRegex },
        { "target.name": searchRegex },
        { "target.entityId": searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

