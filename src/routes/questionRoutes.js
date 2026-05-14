const express = require("express");
const router = express.Router();
const {
  getAll,
  update,
  deleteQuestion,
} = require("../controllers/questionController");
const { authorizeAdmin, authenticateToken } = require("../middleware/auth");

router.get("/", authenticateToken, authorizeAdmin, getAll);
router.patch("/:id", authenticateToken, authorizeAdmin, update);
router.delete("/:id", authenticateToken, authorizeAdmin, deleteQuestion);

module.exports = router;
