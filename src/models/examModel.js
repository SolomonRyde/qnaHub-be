const db = require("../config/db");

const examModel = {
  createExam: async (examData) => {
    // ✅ Normalize topics_covered to JSON string if it's an array
    const topicsCoveredValue = Array.isArray(examData.topics_covered)
      ? JSON.stringify(examData.topics_covered)
      : examData.topics_covered || null;

    const query = `
      INSERT INTO exams 
      (exam_title, slug, total_marks, duration_minutes, no_of_questions, 
       exam_code, description, cover_image_path, industry_id, category_id, 
       sub_category_id, points_per_question, difficulty, status, is_featured, topics_covered)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      examData.exam_title,
      examData.slug,
      examData.total_marks,
      examData.duration_minutes,
      examData.no_of_questions,
      examData.exam_code,
      examData.description,
      examData.cover_image_path,
      examData.industry_id,
      examData.category_id,
      examData.sub_category_id,
      examData.points_per_question,
      examData.difficulty,
      examData.status || "draft",
      examData.is_featured || 0,
      topicsCoveredValue, // ✅ Added topics_covered
    ];

    const [result] = await db.execute(query, values);
    return result.insertId;
  },

  updateExam: async (id, examData) => {
    // ✅ Normalize topics_covered to JSON string if it's an array
    const topicsCoveredValue = Array.isArray(examData.topics_covered)
      ? JSON.stringify(examData.topics_covered)
      : examData.topics_covered !== undefined
        ? examData.topics_covered
        : null;

    const query = `
      UPDATE exams 
      SET exam_title = ?, slug = ?, total_marks = ?, duration_minutes = ?,
          no_of_questions = ?, exam_code = ?, description = ?, 
          cover_image_path = ?, industry_id = ?, category_id = ?,
          sub_category_id = ?, points_per_question = ?, difficulty = ?,
          status = ?, is_featured = ?, topics_covered = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const values = [
      examData.exam_title,
      examData.slug,
      examData.total_marks,
      examData.duration_minutes,
      examData.no_of_questions,
      examData.exam_code,
      examData.description,
      examData.cover_image_path,
      examData.industry_id,
      examData.category_id,
      examData.sub_category_id,
      examData.points_per_question,
      examData.difficulty,
      examData.status,
      examData.is_featured,
      topicsCoveredValue, // ✅ Added topics_covered
      id,
    ];

    const [result] = await db.execute(query, values);
    return result.affectedRows > 0;
  },

  // ✅ DIRECT DELETE: Physically remove from database
  deleteExam: async (id) => {
    const query = `DELETE FROM exams WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result.affectedRows > 0;
  },

  findExamById: async (id) => {
    const query = `
    SELECT 
      e.id, e.exam_title, e.slug, e.total_marks, e.duration_minutes,
      e.no_of_questions, e.exam_code, e.description, e.cover_image_path,
      e.industry_id, e.category_id, e.sub_category_id,
      e.points_per_question, e.difficulty, e.status, e.is_featured,
      e.topics_covered, e.created_at, e.updated_at,
      i.industry_name,
      c.category_name,
      s.sub_category_name
    FROM exams e
    LEFT JOIN industries i ON i.id = e.industry_id
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN subcategories s ON s.id = e.sub_category_id
    WHERE e.id = ?
  `;
    const [rows] = await db.execute(query, [id]);

    if (!rows[0]) return null;

    // ✅ Parse topics_covered JSON if it exists
    if (rows[0].topics_covered && typeof rows[0].topics_covered === "string") {
      try {
        rows[0].topics_covered = JSON.parse(rows[0].topics_covered);
      } catch (e) {
        // If parsing fails, keep as string or set to empty array
        rows[0].topics_covered = [];
      }
    }

    return rows[0];
  },

  findExamBySlug: async (slug) => {
    const query = `
    SELECT 
      e.id, e.exam_title, e.slug, e.total_marks, e.duration_minutes,
      e.no_of_questions, e.exam_code, e.description, e.cover_image_path,
      e.industry_id, e.category_id, e.sub_category_id,
      e.points_per_question, e.difficulty, e.status, e.is_featured,
      e.topics_covered, e.created_at, e.updated_at,
      i.industry_name,
      c.category_name,
      s.sub_category_name
    FROM exams e
    LEFT JOIN industries i ON i.id = e.industry_id
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN subcategories s ON s.id = e.sub_category_id
    WHERE e.slug = ? AND e.status = 'published'
  `;
    const [rows] = await db.execute(query, [slug]);

    if (!rows[0]) return null;

    // ✅ Parse topics_covered JSON if it exists
    if (rows[0].topics_covered && typeof rows[0].topics_covered === "string") {
      try {
        rows[0].topics_covered = JSON.parse(rows[0].topics_covered);
      } catch (e) {
        rows[0].topics_covered = [];
      }
    }

    return rows[0];
  },

  getPaginatedExams: async (filters) => {
    const {
      page = 1,
      limit = 12,
      search = "",
      industry = null,
      category = null,
      subcategory = null,
      difficulty = null,
      status = "published",
      featured = null,
      sort = "latest",
    } = filters;

    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        e.id, e.exam_title, e.slug, e.exam_code, e.total_marks, e.duration_minutes,
        e.no_of_questions, e.points_per_question, e.description, e.cover_image_path,
        e.difficulty, e.status, e.is_featured, e.topics_covered,
        e.industry_id, e.category_id, e.sub_category_id,
        i.industry_name,
        c.category_name,
        s.sub_category_name
      FROM exams e
      LEFT JOIN industries i ON i.id = e.industry_id
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN subcategories s ON s.id = e.sub_category_id
      WHERE 1=1
    `;

    const values = [];

    if (status) {
      query += " AND e.status = ?";
      values.push(status);
    }
    if (industry) {
      query += " AND e.industry_id = ?";
      values.push(industry);
    }
    if (category) {
      query += " AND e.category_id = ?";
      values.push(category);
    }
    if (subcategory) {
      query += " AND e.sub_category_id = ?";
      values.push(subcategory);
    }
    if (difficulty) {
      query += " AND e.difficulty = ?";
      values.push(difficulty);
    }
    if (featured !== null) {
      query += " AND e.is_featured = ?";
      values.push(featured ? 1 : 0);
    }
    if (search) {
      query += " AND (e.exam_title LIKE ? OR e.description LIKE ?)";
      const searchTerm = `%${search}%`;
      values.push(searchTerm, searchTerm);
    }

    // Sorting
    switch (sort) {
      case "latest":
        query += " ORDER BY e.created_at DESC";
        break;
      case "oldest":
        query += " ORDER BY e.created_at ASC";
        break;
      case "difficulty":
        query +=
          ' ORDER BY FIELD(e.difficulty, "easy", "intermediate", "hard")';
        break;
      default:
        query += " ORDER BY e.created_at DESC";
    }

    query += " LIMIT ? OFFSET ?";
    values.push(limit, offset);

    const [rows] = await db.execute(query, values);

    // ✅ Parse topics_covered for each exam
    const parsedRows = rows.map((row) => {
      if (row.topics_covered && typeof row.topics_covered === "string") {
        try {
          row.topics_covered = JSON.parse(row.topics_covered);
        } catch (e) {
          row.topics_covered = [];
        }
      }
      return row;
    });

    // Count query
    let countQuery = `SELECT COUNT(*) as total FROM exams e WHERE 1=1`;
    const countValues = [];

    if (status) {
      countQuery += " AND e.status = ?";
      countValues.push(status);
    }
    if (industry) {
      countQuery += " AND e.industry_id = ?";
      countValues.push(industry);
    }
    if (category) {
      countQuery += " AND e.category_id = ?";
      countValues.push(category);
    }
    if (subcategory) {
      countQuery += " AND e.sub_category_id = ?";
      countValues.push(subcategory);
    }
    if (difficulty) {
      countQuery += " AND e.difficulty = ?";
      countValues.push(difficulty);
    }
    if (featured !== null) {
      countQuery += " AND e.is_featured = ?";
      countValues.push(featured ? 1 : 0);
    }
    if (search) {
      countQuery += " AND (e.exam_title LIKE ? OR e.description LIKE ?)";
      const searchTerm = `%${search}%`;
      countValues.push(searchTerm, searchTerm);
    }

    const [countResult] = await db.execute(countQuery, countValues);
    const total = countResult[0].total;

    return {
      exams: parsedRows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getAdminPaginatedExams: async (filters) => {
    const {
      page = 1,
      limit = 12,
      search = "",
      status = null,
      featured = null,
    } = filters;

    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        e.id, e.exam_title, e.slug, e.exam_code, e.total_marks, e.duration_minutes,
        e.no_of_questions, e.points_per_question, e.description, e.cover_image_path,
        e.difficulty, e.status, e.is_featured, e.topics_covered,
        e.industry_id, e.category_id, e.sub_category_id,
        i.industry_name,
        c.category_name,
        s.sub_category_name
      FROM exams e
      LEFT JOIN industries i ON i.id = e.industry_id
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN subcategories s ON s.id = e.sub_category_id
      WHERE 1=1
    `;

    const values = [];

    if (status) {
      query += " AND e.status = ?";
      values.push(status);
    }
    if (featured !== null) {
      query += " AND e.is_featured = ?";
      values.push(featured ? 1 : 0);
    }
    if (search) {
      query += " AND (e.exam_title LIKE ? OR e.description LIKE ?)";
      const searchTerm = `%${search}%`;
      values.push(searchTerm, searchTerm);
    }

    query += " ORDER BY e.created_at DESC LIMIT ? OFFSET ?";
    values.push(limit, offset);

    const [rows] = await db.execute(query, values);

    // ✅ Parse topics_covered for each exam
    const parsedRows = rows.map((row) => {
      if (row.topics_covered && typeof row.topics_covered === "string") {
        try {
          row.topics_covered = JSON.parse(row.topics_covered);
        } catch (e) {
          row.topics_covered = [];
        }
      }
      return row;
    });

    // Count query
    let countQuery = `SELECT COUNT(*) as total FROM exams e WHERE 1=1`;
    const countValues = [];

    if (status) {
      countQuery += " AND e.status = ?";
      countValues.push(status);
    }
    if (featured !== null) {
      countQuery += " AND e.is_featured = ?";
      countValues.push(featured ? 1 : 0);
    }
    if (search) {
      countQuery += " AND (e.exam_title LIKE ? OR e.description LIKE ?)";
      const searchTerm = `%${search}%`;
      countValues.push(searchTerm, searchTerm);
    }

    const [countResult] = await db.execute(countQuery, countValues);
    const total = countResult[0].total;

    return {
      exams: parsedRows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  updateExamStatus: async (id, status) => {
    const query = `
      UPDATE exams 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [result] = await db.execute(query, [status, id]);
    return result.affectedRows > 0;
  },

  toggleFeatured: async (id, isFeatured) => {
    const query = `
      UPDATE exams 
      SET is_featured = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [result] = await db.execute(query, [isFeatured ? 1 : 0, id]);
    return result.affectedRows > 0;
  },

  getIndustries: async () => {
    const [rows] = await db.execute(
      "SELECT id, industry_name FROM industries ORDER BY industry_name",
    );
    return rows;
  },

  getCategoriesByIndustry: async (industryId) => {
    const [rows] = await db.execute(
      "SELECT id, category_name FROM categories WHERE industry_id = ? ORDER BY category_name",
      [industryId],
    );
    return rows;
  },

  getSubcategoriesByCategory: async (categoryId) => {
    const [rows] = await db.execute(
      "SELECT id, sub_category_name FROM subcategories WHERE category_id = ? ORDER BY sub_category_name",
      [categoryId],
    );
    return rows;
  },

  getExamAnalytics: async (industryId = null) => {
    let query = `
      SELECT 
        COUNT(*) as total_exams,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_count,
        SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) as featured_count,
        AVG(duration_minutes) as avg_duration,
        AVG(no_of_questions) as avg_questions
      FROM exams
      WHERE 1=1
    `;
    const values = [];

    if (industryId) {
      query += " AND industry_id = ?";
      values.push(industryId);
    }

    const [rows] = await db.execute(query, values);
    return rows[0];
  },
};

module.exports = examModel;
