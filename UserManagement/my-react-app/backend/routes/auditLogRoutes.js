const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");
const { getAuditLogs } = require("../controllers/auditLogController");

router.get("/", verifyToken, requireAdmin, getAuditLogs);

module.exports = router;

