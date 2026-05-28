const Joi = require("joi");

const examValidation = {
  createExamSchema: Joi.object({
    exam_title: Joi.string().min(3).max(255).required().messages({
      "string.empty": "Exam title is required",
      "string.min": "Exam title must be at least 3 characters",
      "any.required": "Exam title is required",
    }),
    exam_code: Joi.string().required().messages({
      "string.empty": "Exam Code is required",
      "string.min": "Exam Code must be at least 5 characters",
      "any.required": "Exam Code is required",
    }),
    description: Joi.string().min(10).required().messages({
      "string.empty": "Description is required",
      "string.min": "Description must be at least 10 characters",
      "any.required": "Description is required",
    }),
    duration_minutes: Joi.number().integer().min(1).required().messages({
      "number.base": "Duration must be a number",
      "number.min": "Duration must be at least 1 minute",
      "any.required": "Duration is required",
    }),
    total_marks: Joi.number().integer().min(1).required().messages({
      "number.base": "Total marks must be a number",
      "number.min": "Total marks must be at least 1",
      "any.required": "Total marks is required",
    }),
    no_of_questions: Joi.number().integer().min(1).required().messages({
      "number.base": "Number of questions must be a number",
      "number.min": "At least 1 question is required",
      "any.required": "Number of questions is required",
    }),
    points_per_question: Joi.number().integer().min(1).required().messages({
      "number.base": "Points per question must be a number",
      "number.min": "Points per question must be at least 1",
      "any.required": "Points per question is required",
    }),
    difficulty: Joi.string()
      .valid("easy", "intermediate", "hard")
      .required()
      .messages({
        "any.only": "Difficulty must be easy, intermediate, or hard",
        "any.required": "Difficulty is required",
      }),
    industry_id: Joi.number().integer().min(1).required().messages({
      "number.base": "Industry must be a valid number",
      "any.required": "Industry is required",
    }),
    category_id: Joi.number().integer().min(1).required().messages({
      "number.base": "Category must be a valid number",
      "any.required": "Category is required",
    }),
    sub_category_id: Joi.number().integer().min(1).required().messages({
      "number.base": "Subcategory must be a valid number",
      "any.required": "Subcategory is required",
    }),
    // ✅ NEW: topics_covered - array of strings or JSON string, optional
    topics_covered: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim().min(1).max(100)),
        Joi.string().trim(),
      )
      .required()
      .custom((value) => {
        // If string, try to parse as JSON array; else return as-is or empty array
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return value ? [value] : [];
          }
        }
        return value || [];
      }),
    status: Joi.string()
      .valid("draft", "published", "archived")
      .default("draft"),

    // ✅ NEW - Accepts boolean OR common string representations
    is_featured: Joi.alternatives()
      .try(
        Joi.boolean(),
        Joi.string().valid("true", "false", "1", "0"),
        Joi.number().valid(0, 1),
      )
      .default(false)
      .custom((value) => {
        // Convert string/number to actual boolean
        if (typeof value === "string") {
          return value === "true" || value === "1";
        }
        if (typeof value === "number") {
          return value === 1;
        }
        return value;
      }),
  }),

  updateExamSchema: Joi.object({
    exam_title: Joi.string().min(3).max(255).optional(),
    description: Joi.string().min(10).optional(),
    duration_minutes: Joi.number().integer().min(1).optional(),
    total_marks: Joi.number().integer().min(1).optional(),
    no_of_questions: Joi.number().integer().min(1).optional(),
    points_per_question: Joi.number().integer().min(1).optional(),
    difficulty: Joi.string().valid("easy", "intermediate", "hard").optional(),
    industry_id: Joi.number().integer().min(1).optional(),
    category_id: Joi.number().integer().min(1).optional(),
    sub_category_id: Joi.number().integer().min(1).optional(),
    // ✅ NEW: topics_covered for updates
    topics_covered: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().trim().min(1).max(100)),
        Joi.string().trim(),
      )
      .optional()
      .custom((value) => {
        if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return value ? [value] : [];
          }
        }
        return value || [];
      }),
    status: Joi.string().valid("draft", "published", "archived").optional(),
    is_featured: Joi.alternatives()
      .try(
        Joi.boolean(),
        Joi.string().valid("true", "false", "1", "0"),
        Joi.number().valid(0, 1),
      )
      .optional()
      .custom((value) => {
        if (typeof value === "string") {
          return value === "true" || value === "1";
        }
        if (typeof value === "number") {
          return value === 1;
        }
        return value;
      }),
  }),

  statusUpdateSchema: Joi.object({
    status: Joi.string().valid("draft", "published", "archived").required(),
  }),

  featuredUpdateSchema: Joi.object({
    is_featured: Joi.boolean().required(),
  }),

  queryValidationSchema: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(12),
    search: Joi.string().allow("").optional(),
    industry: Joi.number().integer().allow(null).optional(),
    category: Joi.number().integer().allow(null).optional(),
    subcategory: Joi.number().integer().allow(null).optional(),
    difficulty: Joi.string()
      .valid("easy", "intermediate", "hard")
      .allow(null)
      .optional(),
    status: Joi.string()
      .valid("draft", "published", "archived")
      .default("published"),
    featured: Joi.boolean().allow(null).optional(),
    sort: Joi.string()
      .valid("latest", "oldest", "difficulty")
      .default("latest"),
  }),
};

module.exports = examValidation;
