const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeAdmin } = require("../middleware/auth");
const {
  getDashboardStats,
  getAllUsers,
  softDeleteUser,
  hardDeleteUser,
  bulkHardDeleteUsers,
  bulkSoftDeleteUsers,
  restoreUser,
  bulkRestoreUsers,
  getSingleUser,
  updateUserRole,
} = require("../controllers/adminController");

router.get(
  "/dashboard-stats",
  authenticateToken,
  authorizeAdmin,
  getDashboardStats,
);

router.get("/users", authenticateToken, authorizeAdmin, getAllUsers);
router.get("/users/:id", authenticateToken, authorizeAdmin, getSingleUser);

router.patch(
  "/users/:id/delete",
  authenticateToken,
  authorizeAdmin,
  softDeleteUser,
);
router.delete(
  "/users/:id/purge",
  authenticateToken,
  authorizeAdmin,
  hardDeleteUser,
);

router.patch(
  "/users/bulk-delete",
  authenticateToken,
  authorizeAdmin,
  bulkSoftDeleteUsers,
);
router.delete(
  "/users/bulk-purge",
  authenticateToken,
  authorizeAdmin,
  bulkHardDeleteUsers,
);

router.patch(
  "/users/:id/restore",
  authenticateToken,
  authorizeAdmin,
  restoreUser,
);
router.patch(
  "/users/bulk-restore",
  authenticateToken,
  authorizeAdmin,
  bulkRestoreUsers,
);

router.patch(
  "/users/:id/update-role",
  authenticateToken,
  authorizeAdmin,
  updateUserRole,
);

module.exports = router;
