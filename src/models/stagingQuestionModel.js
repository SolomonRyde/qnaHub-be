const db = require("../config/db");

exports.insertBatch = async (rows, importId, importedBy) => {
  if (!rows.length) return 0;

  const placeholders = rows
    .map(() => "(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)")
    .join(",");

  const sql = `INSERT INTO staging_questions (
    import_id, exam_id, question, option_a, option_b, option_c, option_d, 
    correct_answer, explanation, question_hash, imported_by, created_at
  ) VALUES ${placeholders}`;

  const values = rows.flatMap((r) => [
    importId,
    r.exam_id,
    r.question,
    r.option_a,
    r.option_b,
    r.option_c,
    r.option_d,
    r.correct_answer,
    r.explanation,
    r.question_hash,
    importedBy,
  ]);

  const [result] = await db.query(sql, values);
  return result.affectedRows;
};

/**
 * Get staging questions with pagination, search, and filtering
 * @param {Object} options - Query options
 * @param {number} options.import_id - Required: Import batch ID
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.search - Search term for question/explanation
 * @param {string|number} options.exam_id - Filter by exam ID
 * @param {string} options.stage_status - Filter by status (ready_to_push, duplicate, etc.)
 * @returns {Promise<Object>} Paginated results
 */
exports.getByImportId = async ({
  import_id,
  page = 1,
  limit = 10,
  search = "",
  exam_id = "",
  stage_status = "",
} = {}) => {
  if (!import_id) {
    throw new Error("import_id is required");
  }

  const offset = (page - 1) * limit;

  // Base WHERE clause (import_id is always required)
  const whereConditions = ["import_id = ?"];
  const params = [import_id];

  if (search.trim()) {
    whereConditions.push("(question LIKE ? OR explanation LIKE ?)");
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (exam_id) {
    whereConditions.push("exam_id = ?");
    params.push(exam_id);
  }

  if (stage_status) {
    whereConditions.push("stage_status = ?");
    params.push(stage_status);
  }

  const whereClause = "WHERE " + whereConditions.join(" AND ");

  // COUNT query
  const countSql = `SELECT COUNT(*) as total FROM staging_questions ${whereClause}`;
  const [countResult] = await db.query(countSql, params);
  const total = countResult[0].total;

  // DATA query with pagination
  const dataSql = `
    SELECT * FROM staging_questions 
    ${whereClause}
    ORDER BY stage_id ASC 
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
      import_id: import_id,
      search: search || null,
      exam_id: exam_id || null,
      stage_status: stage_status || null,
    },
  };
};

/**
 * Legacy wrapper for backward compatibility (optional)
 * @deprecated Use getByImportId with options object instead
 */
exports.getByImportIdLegacy = async (importId, status = null) => {
  return exports.getByImportId({
    import_id: importId,
    stage_status: status,
    page: 1,
    limit: 1000, // Return all for legacy calls
  });
};

exports.markDuplicate = async (importId, examId, hash, reason) => {
  const sql = `UPDATE staging_questions 
               SET stage_status = 'duplicate_in_staging', duplicate_reason = ? 
               WHERE import_id = ? AND exam_id = ? AND question_hash = ? AND stage_status = 'ready_to_push'`;
  await db.query(sql, [reason, importId, examId, hash]);
};

exports.updateStatuses = async (updates) => {
  if (!updates.length) return;
  const sql = `UPDATE staging_questions SET stage_status = ?, duplicate_reason = ? WHERE stage_id = ?`;
  await Promise.all(
    updates.map((u) => db.query(sql, [u.status, u.reason, u.stage_id])),
  );
};

exports.getValidByImportId = async (importId) => {
  const [rows] = await db.query(
    'SELECT * FROM staging_questions WHERE import_id = ? AND stage_status = "ready_to_push"',
    [importId],
  );
  return rows;
};

exports.countByStatus = async (importId) => {
  const [rows] = await db.query(
    "SELECT stage_status, COUNT(*) as count FROM staging_questions WHERE import_id = ? GROUP BY stage_status",
    [importId],
  );

  const result = {
    ready_to_push: 0,
    duplicate_in_csv: 0,
    duplicate_in_staging: 0,
    duplicate_in_prod: 0,
    pushed: 0,
  };

  rows.forEach((r) => {
    if (result.hasOwnProperty(r.stage_status)) {
      result[r.stage_status] = r.count;
    }
  });

  return result;
};

exports.markPushed = async (stageIds) => {
  if (!stageIds.length) return;
  await db.query(
    'UPDATE staging_questions SET stage_status = "pushed" WHERE stage_id IN (?)',
    [stageIds],
  );
};

exports.getById = async (stageId) => {
  const [rows] = await db.query(
    "SELECT * FROM staging_questions WHERE stage_id = ?",
    [stageId],
  );
  return rows[0] || null;
};

exports.deleteByImportId = async (importId) => {
  const [result] = await db.query(
    "DELETE FROM staging_questions WHERE import_id = ?",
    [importId],
  );
  return result.affectedRows;
};
