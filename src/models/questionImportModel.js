const db = require("../config/db");

exports.create = async (importData) => {
  const sql = `INSERT INTO question_imports (file_name, uploaded_by, total_rows, csv_valid_rows, csv_error_rows, csv_missing_rows, csv_duplicate_rows, current_stage, stage_history) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const history = JSON.stringify([
    { stage: "UPLOADED", timestamp: new Date().toISOString() },
  ]);
  const [result] = await db.query(sql, [
    importData.file_name,
    importData.uploaded_by,
    importData.total_rows,
    importData.csv_valid_rows,
    importData.csv_error_rows,
    importData.csv_missing_rows,
    importData.csv_duplicate_rows,
    "UPLOADED",
    history,
  ]);
  return result.insertId;
};

exports.getById = async (importId) => {
  const [rows] = await db.query("SELECT * FROM question_imports WHERE id = ?", [
    importId,
  ]);
  return rows[0] || null;
};

/**
 * Get import history with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.search - Search term for file_name or uploaded_by
 * @param {string} options.stage - Filter by current_stage
 * @param {string} options.from - Start date filter
 * @param {string} options.to - End date filter
 * @returns {Promise<Object>} Paginated results
 */
exports.getAll = async ({
  page = 1,
  limit = 10,
  search = "",
  stage = "",
  from = "",
  to = "",
} = {}) => {
  const offset = (page - 1) * limit;

  const whereConditions = [];
  const params = [];

  if (search.trim()) {
    whereConditions.push("(file_name LIKE ? OR uploaded_by LIKE ?)");
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (stage) {
    whereConditions.push("current_stage = ?");
    params.push(stage);
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

  // COUNT query
  const countSql = `SELECT COUNT(*) as total FROM question_imports ${whereClause}`;
  const [countResult] = await db.query(countSql, params);
  const total = countResult[0].total;

  // DATA query
  const dataSql = `
    SELECT * FROM question_imports 
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
      stage: stage || null,
      from: from || null,
      to: to || null,
    },
  };
};

exports.updateStage = async (importId, stage, stats = null) => {
  const updates = { current_stage: stage };
  if (stats) {
    Object.assign(updates, stats);
  }

  const historyAppend = JSON.stringify([
    { stage, timestamp: new Date().toISOString() },
  ]);

  const sql = `UPDATE question_imports 
               SET current_stage = ?, stage_history = JSON_MERGE(stage_history, ?)
               ${Object.keys(updates).includes("csv_valid_rows") ? ", csv_valid_rows=?, csv_error_rows=?, csv_missing_rows=?, csv_duplicate_rows=?" : ""}
               WHERE id = ?`;

  const params = Object.keys(updates).includes("csv_valid_rows")
    ? [
        stage,
        historyAppend,
        stats.csv_valid_rows,
        stats.csv_error_rows,
        stats.csv_missing_rows,
        stats.csv_duplicate_rows,
        importId,
      ]
    : [stage, historyAppend, importId];

  await db.query(sql, params);
};
