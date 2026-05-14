const db = require("../config/db");

exports.insertBatchIgnore = async (questions) => {
  if (!questions.length) return 0;
  const placeholders = questions
    .map(() => "(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
    .join(",");
  const sql = `INSERT IGNORE INTO questions (exam_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, question_hash, created_at) 
               VALUES ${placeholders}`;
  const values = questions.flatMap((q) => [
    q.exam_id,
    q.question,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.correct_answer,
    q.explanation,
    q.question_hash,
  ]);
  const [result] = await db.query(sql, values);
  return result.affectedRows;
};

/**
 * Get questions with pagination, search, and filtering
 * @param {Object} options - Pagination and filter options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.search - Search term for question/explanation
 * @param {string|number} options.exam_id - Filter by exam ID
 * @param {string} options.correct_answer - Filter by correct answer (A/B/C/D)
 * @param {string} options.from - Start date filter (YYYY-MM-DD)
 * @param {string} options.to - End date filter (YYYY-MM-DD)
 * @returns {Promise<Object>} Paginated results with metadata
 */
exports.getAll = async ({
  page = 1,
  limit = 10,
  search = "",
  exam_id = "",
  correct_answer = "",
  from = "",
  to = "",
} = {}) => {
  const offset = (page - 1) * limit;

  // Build WHERE clause dynamically
  const whereConditions = [];
  const params = [];

  if (search.trim()) {
    whereConditions.push("(question LIKE ? OR explanation LIKE ?)");
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (exam_id) {
    whereConditions.push("exam_id = ?");
    params.push(exam_id);
  }

  if (correct_answer && /^[A-D]$/.test(correct_answer.toUpperCase())) {
    whereConditions.push("correct_answer = ?");
    params.push(correct_answer.toUpperCase());
  }

  if (from) {
    whereConditions.push("DATE(created_at) >= ?");
    params.push(from);
  }

  if (to) {
    whereConditions.push("DATE(created_at) <= ?");
    params.push(to);
  }

  const whereClause =
    whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

  // COUNT query for pagination metadata
  const countSql = `SELECT COUNT(*) as total FROM questions ${whereClause}`;
  const [countResult] = await db.query(countSql, params);
  const total = countResult[0].total;

  // DATA query with pagination
  const dataSql = `
    SELECT * FROM questions 
    ${whereClause}
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `;
  const dataParams = [...params, limit, offset];
  const [rows] = await db.query(dataSql, dataParams);

  return {
    data: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: total,
      totalPages: Math.ceil(total / limit),
      hasNext: offset + rows.length < total,
      hasPrev: page > 1,
    },
    filters: {
      search: search || null,
      exam_id: exam_id || null,
      correct_answer: correct_answer || null,
      from: from || null,
      to: to || null,
    },
  };
};

exports.update = async (id, data) => {
  const fields = Object.keys(data)
    .map((k) => `${k} = ?`)
    .join(",");
  const values = Object.values(data).concat(id);
  const sql = `UPDATE questions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const [result] = await db.query(sql, values);
  return result.affectedRows;
};

exports.delete = async (id) => {
  const [result] = await db.query("DELETE FROM questions WHERE id = ?", [id]);
  return result.affectedRows;
};

exports.getExistingHashes = async (examIds) => {
  if (!examIds.length) return new Set();
  const placeholders = examIds.map(() => "?").join(",");
  const sql = `SELECT CONCAT(exam_id, ":", question_hash) as composite_hash FROM questions WHERE exam_id IN (${placeholders})`;
  const [rows] = await db.query(sql, examIds);
  return new Set(rows.map((r) => r.composite_hash));
};
