const db = require("../config/db");

exports.insertBatchIgnore = async (questions, conn = null) => {
  if (!questions.length) return 0;

  const executor = conn || db;

  const placeholders = questions
    .map(() => "(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
    .join(",");

  const sql = `
    INSERT IGNORE INTO questions (
      exam_id,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer,
      explanation,
      question_hash,
      created_at
    ) VALUES ${placeholders}
  `;

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

  const [result] = await executor.query(sql, values);

  return result.affectedRows;
};

/**
 * Get questions with pagination, search, and filtering
 * (includes exam difficulty, industry, category, and sub_category names via JOIN)
 */
exports.getAll = async ({
  page = 1,
  limit = 10,
  search = "",
  exam_id = "",
  correct_answer = "",
  from = "",
  to = "",
  difficulty = "",
  industry = "", // ✅ New
  category = "", // ✅ New
  sub_category = "", // ✅ New
} = {}) => {
  const offset = (page - 1) * limit;

  const whereConditions = [];
  const params = [];

  // Prefix with 'q.' to avoid column ambiguity after JOIN
  if (search.trim()) {
    whereConditions.push("(q.question LIKE ? OR q.explanation LIKE ?)");
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (exam_id) {
    whereConditions.push("q.exam_id = ?");
    params.push(exam_id);
  }

  if (correct_answer && /^[A-D]$/.test(correct_answer.toUpperCase())) {
    whereConditions.push("q.correct_answer = ?");
    params.push(correct_answer.toUpperCase());
  }

  if (from) {
    whereConditions.push("DATE(q.created_at) >= ?");
    params.push(from);
  }

  if (to) {
    whereConditions.push("DATE(q.created_at) <= ?");
    params.push(to);
  }

  if (
    difficulty &&
    ["easy", "intermediate", "hard"].includes(difficulty.toLowerCase())
  ) {
    whereConditions.push("e.difficulty = ?");
    params.push(difficulty.toLowerCase());
  }

  // ✅ NEW: Add WHERE conditions for industry, category, and sub_category
  if (industry) {
    whereConditions.push("i.industry_name = ?");
    params.push(industry);
  }

  if (category) {
    whereConditions.push("c.category_name = ?");
    params.push(category);
  }

  if (sub_category) {
    whereConditions.push("sc.sub_category_name = ?");
    params.push(sub_category);
  }

  const whereClause =
    whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

  // ✅ Common JOINs for both COUNT and DATA queries
  const joins = `
    LEFT JOIN exams e ON q.exam_id = e.id
    LEFT JOIN industries i ON e.industry_id = i.id
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN subcategories sc ON e.sub_category_id = sc.id
  `;

  // ✅ COUNT query includes JOIN to ensure accurate pagination when filtering
  const countSql = `
    SELECT COUNT(*) as total 
    FROM questions q
    ${joins}
    ${whereClause}
  `;
  const [countResult] = await db.query(countSql, params);
  const total = countResult[0].total;

  // ✅ DATA query explicitly selects question fields + exam difficulty + category names
  const dataSql = `
    SELECT 
      q.id,
      q.exam_id,
      q.question,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_answer,
      q.explanation,
      q.question_hash,
      q.created_at,
      q.updated_at,
      e.difficulty AS difficulty,
      i.industry_name AS industry,
      c.category_name AS category,
      sc.sub_category_name AS sub_category
    FROM questions q
    ${joins}
    ${whereClause}
    ORDER BY q.created_at DESC 
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
      difficulty: difficulty || null,
      industry: industry || null, // ✅ Included in filters response
      category: category || null, // ✅ Included in filters response
      sub_category: sub_category || null, // ✅ Included in filters response
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

exports.deleteBulk = async (ids) => {
  if (!ids || !ids.length) return 0;
  const placeholders = ids.map(() => "?").join(",");
  const sql = `DELETE FROM questions WHERE id IN (${placeholders})`;
  const [result] = await db.query(sql, ids);
  return result.affectedRows;
};

exports.getExistingHashes = async (examIds) => {
  if (!examIds.length) return new Set();
  const placeholders = examIds.map(() => "?").join(",");
  const sql = `SELECT CONCAT(exam_id, ":", question_hash) as composite_hash FROM questions WHERE exam_id IN (${placeholders})`;
  const [rows] = await db.query(sql, examIds);
  return new Set(rows.map((r) => r.composite_hash));
};

/**
 * Fetch questions for an active exam session.
 *
 * ⚠️  SECURITY: correct_answer and explanation are intentionally excluded
 * to prevent cheating via the browser network tab.
 * Evaluation happens server-side in examAttemptController → submitExam().
 */
exports.getQuestionsForExam = async (exam_id, limit) => {
  const sql = `SELECT id, question, option_a, option_b, option_c, option_d 
               FROM questions 
               WHERE exam_id = ? 
               ORDER BY RAND() 
               LIMIT ?`;
  const [rows] = await db.execute(sql, [exam_id, limit]);
  return rows;
};

/**
 * Fetch correct answers for all questions belonging to an exam.
 * Used ONLY on the backend during answer evaluation — never sent to the client.
 */
exports.getCorrectAnswersForExam = async (exam_id, questionIds) => {
  if (!questionIds || questionIds.length === 0) return {};

  const placeholders = questionIds.map(() => "?").join(",");
  // We filter by exam_id to prevent users from submitting random question IDs from other exams
  const sql = `SELECT id, correct_answer FROM questions WHERE exam_id = ? AND id IN (${placeholders})`;

  const params = [exam_id, ...questionIds];
  const [rows] = await db.execute(sql, params);

  return Object.fromEntries(rows.map((r) => [r.id, r.correct_answer]));
};
