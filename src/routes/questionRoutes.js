const express = require("express");
const router = express.Router();
const {
  getAll,
  update,
  deleteQuestion,
  deleteBulk,
} = require("../controllers/questionController");
const { authorizeAdmin, authenticateToken } = require("../middleware/auth");

router.get("/", authenticateToken, authorizeAdmin, getAll);
router.patch("/:id", authenticateToken, authorizeAdmin, update);
router.delete("/bulk", authenticateToken, authorizeAdmin, deleteBulk);
router.delete("/:id", authenticateToken, authorizeAdmin, deleteQuestion);

module.exports = router;
