const express = require("express");
const router = express.Router();
const {
  getAllIndustries,
  createIndustry,
  updateIndustry,
  deleteIndustry,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} = require("../controllers/industryController");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth");
// Note: Removed cacheMiddleware for pagination endpoint since query params vary

// GET nested hierarchy with pagination support (NO caching due to dynamic params)
router.get("/all-industries-categories-subcategories", getAllIndustries);

// Industry CRUD
router.post("/industries", authenticateToken, authorizeAdmin, createIndustry);
router.patch(
  "/industries/:id",
  authenticateToken,
  authorizeAdmin,
  updateIndustry,
);
router.delete(
  "/industries/:id",
  authenticateToken,
  authorizeAdmin,
  deleteIndustry,
);

// Category CRUD
router.post("/categories", authenticateToken, authorizeAdmin, createCategory);
router.patch(
  "/categories/:id",
  authenticateToken,
  authorizeAdmin,
  updateCategory,
);
router.delete(
  "/categories/:id",
  authenticateToken,
  authorizeAdmin,
  deleteCategory,
);

// Subcategory CRUD
router.post(
  "/subcategories",
  authenticateToken,
  authorizeAdmin,
  createSubcategory,
);
router.patch(
  "/subcategories/:id",
  authenticateToken,
  authorizeAdmin,
  updateSubcategory,
);
router.delete(
  "/subcategories/:id",
  authenticateToken,
  authorizeAdmin,
  deleteSubcategory,
);

module.exports = router;
