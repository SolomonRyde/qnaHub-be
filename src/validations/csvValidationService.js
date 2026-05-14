const path = require("path");

/**
 * Parses and validates CSV string.
 * Returns { validRows, invalidRows, stats }
 */
exports.parseAndValidateCSV = (csvBuffer, file) => {
  const content = csvBuffer.toString("utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    throw new Error("CSV file is empty or malformed");
  }

  // Expected CSV headers
  const expectedHeaders = [
    "exam_id",
    "question",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_answer",
    "explanation",
  ];

  const headerLine = parseCSVLine(lines[0].toLowerCase());
  const headerMap = headerLine.map((h, i) => ({ name: h.trim(), index: i }));

  const validRows = [];
  const invalidRows = [];
  const stats = {
    total: lines.length - 1, // Exclude header
    valid: 0,
    errors: 0,
    missing: 0,
    duplicates: 0,
  };

  // Track duplicates inside same CSV using a Set
  const csvHashes = new Set();

  for (let i = 1; i < lines.length; i++) {
    const rowObj = parseCSVLine(lines[i]);
    const rowMap = {};

    headerMap.forEach((h) => {
      rowMap[h.name] = (rowObj[h.index] || "").trim();
    });

    const validationError = validateRow(rowMap, i + 1);

    if (validationError) {
      stats.errors++;
      invalidRows.push({ row: i + 1, error: validationError, rowMap });
      continue;
    }

    // Check internal CSV duplicates using question text
    const { generateHash } = require("../services/questionHashService");
    const hash = generateHash(rowMap.question);
    const internalKey = `${rowMap.exam_id}:${hash}`;

    if (csvHashes.has(internalKey)) {
      stats.duplicates++;
      invalidRows.push({
        row: i + 1,
        error: "Duplicate question found within CSV",
        data: rowMap,
      });
      continue;
    }

    csvHashes.add(internalKey);
    stats.valid++;
    validRows.push({
      exam_id: parseInt(rowMap.exam_id),
      question: rowMap.question,
      option_a: rowMap.option_a,
      option_b: rowMap.option_b,
      option_c: rowMap.option_c,
      option_d: rowMap.option_d,
      correct_answer: rowMap.correct_answer.toUpperCase(),
      explanation: rowMap.explanation || null,
      question_hash: hash,
    });
  }

  return { validRows, invalidRows, stats };
};

// Simple CSV line parser handling quotes
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function validateRow(row, rowNum) {
  const required = [
    "exam_id",
    "question",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_answer",
  ];

  for (const field of required) {
    if (!row[field] || row[field].toString().trim() === "") {
      return `Missing required field: ${field}`;
    }
  }

  if (isNaN(row.exam_id) || parseInt(row.exam_id) <= 0) {
    return `Invalid exam_id at row ${rowNum}`;
  }

  if (!["A", "B", "C", "D"].includes(row.correct_answer.toUpperCase())) {
    return `correct_answer must be A, B, C, or D. Got: ${row.correct_answer}`;
  }

  return null;
}
