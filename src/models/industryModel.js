const db = require("../config/db");

// ==================== READ ====================

/**
 * Get paginated hierarchy data with filters
 * @param {Object} params - { page, limit, search, industry, category }
 */
exports.getPaginatedHierarchy = async (params) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    industry = "",
    category = "",
  } = params;

  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;

  // ==================== STEP 1 ====================
  // Get paginated industry IDs matching filters

  const [industryRows] = await db.query(
    `
    SELECT DISTINCT i.id, i.industry_name, i.created_at
    FROM industries i
    LEFT JOIN categories c ON c.industry_id = i.id
    LEFT JOIN subcategories s ON s.category_id = c.id
    WHERE
      (
        ? = '' 
        OR i.industry_name LIKE ?
        OR c.category_name LIKE ?
        OR s.sub_category_name LIKE ?
      )
      AND (? = '' OR i.id = ?)
      AND (? = '' OR c.id = ?)
    ORDER BY i.id
    LIMIT ? OFFSET ?
    `,
    [
      search,
      searchParam,
      searchParam,
      searchParam,
      industry,
      industry,
      category,
      category,
      limit,
      offset,
    ],
  );

  if (industryRows.length === 0) {
    return {
      rows: [],
      total: 0,
    };
  }

  const industryIds = industryRows.map((r) => r.id);
  const placeholders = industryIds.map(() => "?").join(",");

  // ==================== STEP 2 ====================
  // Get total count

  const [countRows] = await db.query(
    `
    SELECT COUNT(DISTINCT i.id) as total
    FROM industries i
    LEFT JOIN categories c ON c.industry_id = i.id
    LEFT JOIN subcategories s ON s.category_id = c.id
    WHERE
      (
        ? = '' 
        OR i.industry_name LIKE ?
        OR c.category_name LIKE ?
        OR s.sub_category_name LIKE ?
      )
      AND (? = '' OR i.id = ?)
      AND (? = '' OR c.id = ?)
    `,
    [
      search,
      searchParam,
      searchParam,
      searchParam,
      industry,
      industry,
      category,
      category,
    ],
  );

  // ==================== STEP 3 ====================
  // Fetch full hierarchy ONLY for filtered data

  let fullQuery = `
    SELECT 
      i.id AS industry_id,
      i.industry_name,
      i.created_at AS industry_created_at,

      c.id AS category_id,
      c.category_name,
      c.created_at AS category_created_at,

      s.id AS subcategory_id,
      s.sub_category_name,
      s.created_at AS subcategory_created_at

    FROM industries i

    LEFT JOIN categories c 
      ON c.industry_id = i.id

    LEFT JOIN subcategories s 
      ON s.category_id = c.id

    WHERE i.id IN (${placeholders})
  `;

  const queryParams = [...industryIds];

  // IMPORTANT FIX
  // Re-apply category filter here
  if (category !== "") {
    fullQuery += ` AND c.id = ?`;
    queryParams.push(category);
  }

  // OPTIONAL:
  // Re-apply industry filter too
  if (industry !== "") {
    fullQuery += ` AND i.id = ?`;
    queryParams.push(industry);
  }

  fullQuery += `
    ORDER BY i.id, c.id, s.id
  `;

  const [fullData] = await db.query(fullQuery, queryParams);

  // ==================== STEP 4 ====================
  // Get overall stats

  const [statsRows] = await db.query(`
  SELECT
    (SELECT COUNT(*) FROM industries) AS totalIndustries,
    (SELECT COUNT(*) FROM categories) AS totalCategories,
    (SELECT COUNT(*) FROM subcategories) AS totalSubcategories
`);

  const stats = statsRows[0];

  return {
    rows: fullData,
    total: countRows[0]?.total || 0,
    stats,
  };
};

// ==================== LEGACY METHOD ====================

exports.getAllData = async () => {
  const [rows] = await db.query(`
    SELECT 
      i.id AS industry_id,
      i.industry_name,
      i.created_at AS industry_created_at,

      c.id AS category_id,
      c.category_name,
      c.created_at AS category_created_at,

      s.id AS subcategory_id,
      s.sub_category_name,
      s.created_at AS subcategory_created_at

    FROM industries i

    LEFT JOIN categories c 
      ON c.industry_id = i.id

    LEFT JOIN subcategories s 
      ON s.category_id = c.id

    ORDER BY i.id, c.id, s.id
  `);

  return rows;
};

// ==================== INDUSTRIES ====================

exports.createIndustry = async (industryName) => {
  const [result] = await db.query(
    "INSERT INTO industries (industry_name) VALUES (?)",
    [industryName],
  );

  return result.insertId;
};

exports.findIndustryById = async (id) => {
  const [rows] = await db.query("SELECT * FROM industries WHERE id = ?", [id]);

  return rows[0];
};

exports.updateIndustry = async (id, industryName) => {
  const [result] = await db.query(
    "UPDATE industries SET industry_name = ? WHERE id = ?",
    [industryName, id],
  );

  return result.affectedRows;
};

exports.deleteIndustry = async (id) => {
  const [result] = await db.query("DELETE FROM industries WHERE id = ?", [id]);

  return result.affectedRows;
};

// ==================== CATEGORIES ====================

exports.createCategory = async (categoryName, industryId) => {
  const [result] = await db.query(
    "INSERT INTO categories (category_name, industry_id) VALUES (?, ?)",
    [categoryName, industryId],
  );

  return result.insertId;
};

exports.findCategoryById = async (id) => {
  const [rows] = await db.query("SELECT * FROM categories WHERE id = ?", [id]);

  return rows[0];
};

exports.updateCategory = async (id, categoryName) => {
  const [result] = await db.query(
    "UPDATE categories SET category_name = ? WHERE id = ?",
    [categoryName, id],
  );

  return result.affectedRows;
};

exports.deleteCategory = async (id) => {
  const [result] = await db.query("DELETE FROM categories WHERE id = ?", [id]);

  return result.affectedRows;
};

// ==================== SUBCATEGORIES ====================

exports.createSubcategory = async (subCategoryName, categoryId) => {
  const [result] = await db.query(
    "INSERT INTO subcategories (sub_category_name, category_id) VALUES (?, ?)",
    [subCategoryName, categoryId],
  );

  return result.insertId;
};

exports.findSubcategoryById = async (id) => {
  const [rows] = await db.query("SELECT * FROM subcategories WHERE id = ?", [
    id,
  ]);

  return rows[0];
};

exports.updateSubcategory = async (id, subCategoryName) => {
  const [result] = await db.query(
    "UPDATE subcategories SET sub_category_name = ? WHERE id = ?",
    [subCategoryName, id],
  );

  return result.affectedRows;
};

exports.deleteSubcategory = async (id) => {
  const [result] = await db.query("DELETE FROM subcategories WHERE id = ?", [
    id,
  ]);

  return result.affectedRows;
};
