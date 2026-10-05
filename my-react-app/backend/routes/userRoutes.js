const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");
const { getUsers, deleteUser } = require("../controllers/userController");

router.get("/", verifyToken, requireAdmin, getUsers);
router.delete("/:id", verifyToken, requireAdmin, deleteUser);

module.exports = router;
