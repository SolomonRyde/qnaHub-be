const crypto = require("crypto");

/**
 * Generates a deterministic SHA256 hash from question text.
 * Normalizes: lowercase, trim, collapse multiple spaces, remove punctuation.
 */
exports.generateHash = (questionText) => {
  if (!questionText || typeof questionText !== "string") return "";

  const normalized = questionText
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/[.,!?;:'"()\-]/g, ""); // Remove common punctuation for fuzzy matching

  return crypto.createHash("sha256").update(normalized).digest("hex");
};
