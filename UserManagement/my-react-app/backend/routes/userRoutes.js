const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");
const { getUsers, deleteUser, updateUser } = require("../controllers/userController");

router.get("/", verifyToken, requireAdmin, getUsers);
router.put("/:id", verifyToken, requireAdmin, updateUser);
router.delete("/:id", verifyToken, requireAdmin, deleteUser);

module.exports = router;
