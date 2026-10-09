const express = require("express");
const router = express.Router();
const {
  generateResponse,
  generateWithPdf,
  getAiStats,
  getGeneratedFiles,
  deleteGeneratedFile,
} = require("../controllers/llmQuestionController");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth");
const { uploadPdf } = require("../middleware/uploadPdfMiddleware");

router.post("/", authenticateToken, authorizeAdmin, generateResponse);
router.post(
  "/generate-with-pdf",
  authenticateToken,
  authorizeAdmin,
  uploadPdf.single("pdf"),
  generateWithPdf
);
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
