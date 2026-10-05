const { adminMiddleware } = require("./authMiddleware");
module.exports = { requireAdmin: adminMiddleware };
