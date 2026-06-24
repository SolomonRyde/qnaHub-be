const express = require("express");
const router = express.Router();
const {
  generateResponse,
  getAiStats,
  getGeneratedFiles,
  deleteGeneratedFile,
} = require("../controllers/llmQuestionController");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth");

router.post("/", authenticateToken, authorizeAdmin, generateResponse);
router.get("/stats", authenticateToken, authorizeAdmin, getAiStats);
router.get(
  "/generated-files",
  authenticateToken,
  authorizeAdmin,
  getGeneratedFiles,
);
router.delete(
  "/generated-files/:id",
  authenticateToken,
  authorizeAdmin,
  deleteGeneratedFile,
);

module.exports = router;
