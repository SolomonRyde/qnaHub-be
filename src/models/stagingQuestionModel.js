const db = require("../config/db");

// Explicitly define the columns to fetch for consistency
const STAGING_COLUMNS = `
  stage_id, import_id, exam_id, question, option_a, option_b, option_c, option_d, 
  correct_answer, explanation, question_hash, imported_by, stage_status, 
  duplicate_reason, created_at
`;

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
 * Includes JOINs to fetch file_name, difficulty, industry, category, and sub_category names
 */
exports.getByImportId = async ({
  import_id,
  page = 1,
  limit = 10,
  search = "",
  exam_id = "",
  stage_status = "",
} = {}) => {
  const offset = (page - 1) * limit;

  // Base condition: Exclude pushed questions
  const whereConditions = ["qs.stage_status != 'pushed'"];
  const params = [];

  if (import_id) {
    whereConditions.push("qs.import_id = ?");
    params.push(import_id);
  }

  if (search.trim()) {
    whereConditions.push("(qs.question LIKE ? OR qs.explanation LIKE ?)");
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (exam_id) {
    whereConditions.push("qs.exam_id = ?");
    params.push(exam_id);
  }

  if (stage_status) {
    whereConditions.push("qs.stage_status = ?");
    params.push(stage_status);
  }

  const whereClause = "WHERE " + whereConditions.join(" AND ");

  // COUNT query with all JOINs
  const countSql = `
    SELECT COUNT(qs.stage_id) as total 
    FROM staging_questions qs
    LEFT JOIN question_imports qib ON qib.id = qs.import_id
    LEFT JOIN exams e ON e.id = qs.exam_id
    LEFT JOIN industries i ON i.id = e.industry_id
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN subcategories sc ON sc.id = e.sub_category_id
    ${whereClause}
  `;
  const [countResult] = await db.query(countSql, params);
  const total = countResult[0].total;

  // DATA query with all JOINs, explicit columns, and pagination
  const dataSql = `
    SELECT 
      qs.stage_id, 
      qs.import_id, 
      qib.file_name, 
      qs.exam_id, 
      e.difficulty,
      e.industry_id,
      e.category_id,
      e.sub_category_id,
      i.industry_name AS industry,
      c.category_name AS category,
      sc.sub_category_name AS sub_category,
      qs.question, 
      qs.option_a, 
      qs.option_b, 
      qs.option_c, 
      qs.option_d, 
      qs.correct_answer, 
      qs.explanation, 
      qs.question_hash, 
      qs.imported_by, 
      qs.stage_status, 
      qs.duplicate_reason, 
      qs.created_at,
      qib.created_at AS import_created_at
    FROM staging_questions qs
    LEFT JOIN question_imports qib ON qib.id = qs.import_id
    LEFT JOIN exams e ON e.id = qs.exam_id
    LEFT JOIN industries i ON i.id = e.industry_id
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN subcategories sc ON sc.id = e.sub_category_id
    ${whereClause}
    ORDER BY qs.created_at DESC, qs.stage_id DESC 
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
      import_id: import_id || null,
      search: search || null,
      exam_id: exam_id || null,
      stage_status: stage_status || null,
    },
  };
};

exports.getByImportIdLegacy = async (importId, status = null) => {
  return exports.getByImportId({
    import_id: importId,
    stage_status: status,
    page: 1,
    limit: 1000,
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

/**
 * ✅ NEW: Fetch valid (ready_to_push) staging rows.
 * If importId is provided, it filters by that import. Otherwise, fetches all.
 */
exports.getValidStagingRows = async (importId = null) => {
  let sql = `SELECT ${STAGING_COLUMNS} FROM staging_questions WHERE stage_status = "ready_to_push"`;
  const params = [];

  if (importId) {
    sql += " AND import_id = ?";
    params.push(importId);
  }

  const [rows] = await db.query(sql, params);
  return rows;
};

// Keep existing function for backward compatibility, just delegate to the new one
exports.getValidByImportId = async (importId) => {
  return exports.getValidStagingRows(importId);
};

exports.countByStatus = async (importId) => {
  const [rows] = await db.query(
    "SELECT stage_status, COUNT(*) as count FROM staging_questions WHERE import_id = ? GROUP BY stage_status",
    [importId],
  );

  const result = {
    ready_to_push: 0,
    duplicate_in_staging: 0,
    duplicate_in_main: 0, // ✅ Changed from duplicate_in_prod
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
    `SELECT ${STAGING_COLUMNS} 
     FROM staging_questions 
     WHERE stage_id = ?`,
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

exports.getReadyToPushByImportId = async (importId) => {
  const [rows] = await db.query(
    `SELECT *
     FROM staging_questions
     WHERE import_id = ?
     AND stage_status = 'ready_to_push'`,
    [importId],
  );

  return rows;
};

// UPDATE existing markPushed to support optional connection for transactions
exports.markPushed = async (stageIds, conn = null) => {
  if (!stageIds.length) return;
  const executor = conn || db;
  await executor.query(
    'UPDATE staging_questions SET stage_status = "pushed" WHERE stage_id IN (?)',
    [stageIds],
  );
};

/**
 * Get global final push preview statistics
 */
exports.getFinalPushPreview = async () => {
  // 1. total_staging and ready_to_push
  const [counts] = await db.query(`
    SELECT 
      COUNT(*) as total_staging,
      SUM(CASE WHEN stage_status = 'ready_to_push' THEN 1 ELSE 0 END) as ready_to_push
    FROM staging_questions
    WHERE stage_status != 'pushed'
  `);

  const total_staging = counts[0].total_staging || 0;
  const ready_to_push = counts[0].ready_to_push || 0;

  // 2. distinct_staging_hashes
  const [distinct] = await db.query(`
    SELECT COUNT(DISTINCT question_hash) as distinct_hashes
    FROM staging_questions
    WHERE stage_status != 'pushed'
  `);
  const distinct_staging_hashes = distinct[0].distinct_hashes || 0;

  // Duplicates = Total non-pushed rows - Unique hashes
  const duplicates_inside_staging = total_staging - distinct_staging_hashes;

  // 3. distinct_hashes_already_in_main
  const [inMain] = await db.query(`
    SELECT COUNT(DISTINCT s.question_hash) as already_in_main
    FROM staging_questions s
    INNER JOIN questions q ON s.question_hash = q.question_hash
    WHERE s.stage_status != 'pushed'
  `);
  const already_in_main_db = inMain[0].already_in_main || 0;

  const final_distinct = distinct_staging_hashes - already_in_main_db;

  return {
    total_staging,
    ready_to_push,
    already_in_main_db,
    duplicates_inside_staging,
    final_distinct,
  };
};

/**
 * Fetch only the earliest non-pushed staging row for each unique hash
 * that does not already exist in the main questions table.
 */
exports.getFinalDistinctQuestions = async (conn = null) => {
  const executor = conn || db;
  const [rows] = await executor.query(`
    SELECT s.*
    FROM staging_questions s
    LEFT JOIN questions q ON q.question_hash = s.question_hash
    WHERE q.question_hash IS NULL
    AND s.stage_status != 'pushed'
    AND s.stage_id = (
        SELECT MIN(s2.stage_id)
        FROM staging_questions s2
        WHERE s2.question_hash = s.question_hash
        AND s2.stage_status != 'pushed'
    )
  `);
  return rows;
};

/**
 * Mark remaining rows as duplicates within staging.
 * Targets rows with the same hash but a higher stage_id than the row that was just pushed.
 */
exports.markStagingDuplicates = async (conn = null) => {
  const executor = conn || db;
  const [result] = await executor.query(`
    UPDATE staging_questions s
    INNER JOIN staging_questions s2 
      ON s.question_hash = s2.question_hash 
      AND s.stage_id > s2.stage_id
    SET s.stage_status = 'duplicate_in_staging', 
        s.duplicate_reason = 'Duplicate inside staging'
    WHERE s2.stage_status = 'pushed' 
    AND s.stage_status NOT IN ('pushed', 'duplicate_in_prod')
  `);
  return result.affectedRows;
};

/**
 * Mark rows as duplicates in production.
 * Targets any row whose hash already exists in the main questions table.
 */
exports.markProductionDuplicates = async (conn = null) => {
  const executor = conn || db;
  const [result] = await executor.query(`
    UPDATE staging_questions s
    INNER JOIN questions q ON s.question_hash = q.question_hash
    SET s.stage_status = 'duplicate_in_main',  -- ✅ Changed to duplicate_in_main
        s.duplicate_reason = 'Already exists in production'
    WHERE s.stage_status NOT IN ('pushed', 'duplicate_in_staging', 'duplicate_in_main') -- ✅ Exclude itself
  `);
  return result.affectedRows;
};

/**
 * Validate all staging questions and return counts for each status category.
 * Categories are mutually exclusive and sum up exactly to total_staging.
 */
exports.validateAllStaging = async () => {
  // 1. Total staging (excluding already pushed questions)
  const [totalRes] = await db.query(`
    SELECT COUNT(*) as total_staging 
    FROM staging_questions 
    WHERE stage_status != 'pushed'
  `);
  const total_staging = totalRes[0].total_staging || 0;

  // 2. Count errors (rows with missing or invalid critical data)
  const [errorRes] = await db.query(`
    SELECT COUNT(*) as errors 
    FROM staging_questions 
    WHERE stage_status != 'pushed' 
    AND (
      question IS NULL OR TRIM(question) = '' OR
      question_hash IS NULL OR TRIM(question_hash) = '' OR
      exam_id IS NULL OR
      UPPER(correct_answer) NOT IN ('A', 'B', 'C', 'D') OR
      option_a IS NULL OR option_b IS NULL OR option_c IS NULL OR option_d IS NULL
    )
  `);
  const errors = errorRes[0].errors || 0;

  // 3. Count rows already in main DB (excluding errors)
  const [mainRes] = await db.query(`
    SELECT COUNT(*) as already_in_main_db
    FROM staging_questions s
    INNER JOIN questions q ON s.question_hash = q.question_hash
    WHERE s.stage_status != 'pushed'
    AND s.question IS NOT NULL AND TRIM(s.question) != ''
    AND s.question_hash IS NOT NULL AND TRIM(s.question_hash) != ''
    AND s.exam_id IS NOT NULL
    AND UPPER(s.correct_answer) IN ('A', 'B', 'C', 'D')
    AND s.option_a IS NOT NULL AND s.option_b IS NOT NULL AND s.option_c IS NOT NULL AND s.option_d IS NOT NULL
  `);
  const already_in_main_db = mainRes[0].already_in_main_db || 0;

  // 4 & 5. Count duplicates inside staging and ready to push
  // We count total valid non-main rows, and distinct valid non-main hashes
  const [validNonMainRes] = await db.query(`
    SELECT 
      COUNT(*) as total_valid_non_main, 
      COUNT(DISTINCT s.question_hash) as distinct_valid_non_main
    FROM staging_questions s
    LEFT JOIN questions q ON s.question_hash = q.question_hash
    WHERE s.stage_status != 'pushed'
    AND q.question_hash IS NULL
    AND s.question IS NOT NULL AND TRIM(s.question) != ''
    AND s.question_hash IS NOT NULL AND TRIM(s.question_hash) != ''
    AND s.exam_id IS NOT NULL
    AND UPPER(s.correct_answer) IN ('A', 'B', 'C', 'D')
    AND s.option_a IS NOT NULL AND s.option_b IS NOT NULL AND s.option_c IS NOT NULL AND s.option_d IS NOT NULL
  `);

  const total_valid_non_main = validNonMainRes[0].total_valid_non_main || 0;
  const ready_to_push = validNonMainRes[0].distinct_valid_non_main || 0;

  // Duplicates are the remaining rows that aren't unique
  const duplicates_inside_staging = total_valid_non_main - ready_to_push;

  return {
    total_staging,
    ready_to_push,
    duplicates_inside_staging,
    already_in_main_db,
    errors,
  };
};

/**
 * Delete a single staging question by stage_id
 */
exports.deleteSingle = async (stageId) => {
  const [result] = await db.query(
    "DELETE FROM staging_questions WHERE stage_id = ?",
    [stageId],
  );
  return result.affectedRows;
};

/**
 * Delete all duplicate questions from staging
 * Removes questions marked as duplicate_in_staging, already_in_main_db, or duplicate
 */
exports.deleteDuplicates = async () => {
  const [result] = await db.query(
    `DELETE FROM staging_questions 
     WHERE stage_status IN ('duplicate_in_staging', 'duplicate_in_main')`, // ✅ Changed to duplicate_in_main
  );
  return result.affectedRows;
};

/**
 * Delete all staging questions
 * WARNING: This removes ALL questions from staging table
 */
exports.deleteAllStagingQuestions = async () => {
  const [result] = await db.query(`DELETE FROM staging_questions`);
  return result.affectedRows;
};

/**
 * Delete staging questions by status
 */
exports.deleteByStatus = async (status) => {
  const [result] = await db.query(
    `DELETE FROM staging_questions WHERE stage_status = ?`,
    [status],
  );
  return result.affectedRows;
};
