const express = require('express');
const router = express.Router();
const upload = require("../middleware/upload");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");

const {
  createUser,
  uploadUsersFromFile,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  deleteAllUsers,
  exportUsers,
  downloadTemplate
} = require("../controllers/userControllers");

// Protected Admin Routes (Requires valid JWT + Admin Role)
router.get('/', verifyToken, requireAdmin, getUsers);
router.get('/export', verifyToken, requireAdmin, exportUsers);
router.get('/template', downloadTemplate);
router.get('/:id', verifyToken, getUser);

router.post('/', verifyToken, requireAdmin, upload.single('avatar'), createUser);
router.post('/import', verifyToken, requireAdmin, upload.single('file'), uploadUsersFromFile);
router.put('/:id', verifyToken, requireAdmin, upload.single('avatar'), updateUser);

router.delete('/all/clear', verifyToken, requireAdmin, deleteAllUsers);
router.delete('/:id', verifyToken, requireAdmin, deleteUser);

module.exports = router;
