const examModel = require("../models/examModel.js");
const slugService = require("../services/slugService.js");
const examValidation = require("../validations/examValidation.js");

const examController = {
  createExam: async (req, res) => {
    try {


    console.log("📦 BODY:", req.body);
    console.log("📁 FILE:", req.file);

      if (!examValidation?.createExamSchema) {
        throw new Error(
          "createExamSchema is undefined - check examValidation.js export",
        );
      }

      const { error, value } = examValidation.createExamSchema.validate(
        req.body,
        {
          convert: true,
          allowUnknown: true,
        },
      );

      if (error) {
        console.error("❌ Validation errors:", error.details);
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      const slug = await slugService.generateSlug(value.exam_title, examModel);

      let coverImagePath = "";
      if (req.file) {
        coverImagePath = `/uploads/exams/${req.file.filename}`;
      }

      // ✅ topics_covered is already normalized by validation, pass through
      const examId = await examModel.createExam({
        ...value,
        slug,
        cover_image_path: coverImagePath,
      });

      const exam = await examModel.findExamById(examId);
      console.log("✅ Exam created:", examId);

      res.status(201).json({
        success: true,
        message: "Exam created successfully",
        data: exam,
      });
    } catch (error) {
      console.error("💥 Error creating exam:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create exam",
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },

  updateExam: async (req, res) => {
    try {
      const { id } = req.params;

      console.log("📥 PATCH /exam/:id Received");
      console.log("📦 Body:", req.body);
      console.log("📁 File:", req.file);

      const existingExam = await examModel.findExamById(id);
      if (!existingExam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }

      const { error, value } = examValidation.updateExamSchema.validate(
        req.body,
        {
          convert: true,
          allowUnknown: true,
        },
      );

      if (error) {
        console.error("❌ Validation Failed:", error.details);
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      let slug = existingExam.slug;
      if (value.exam_title && value.exam_title !== existingExam.exam_title) {
        slug = await slugService.generateSlug(
          value.exam_title,
          examModel,
          parseInt(id),
        );
      }

      let coverImagePath = existingExam.cover_image_path;
      if (req.file) {
        coverImagePath = `/uploads/exams/${req.file.filename}`;
      }

      // ✅ Merge existing exam with new values, topics_covered handled by model
      const updated = await examModel.updateExam(id, {
        ...existingExam,
        ...value,
        slug,
        cover_image_path: coverImagePath,
      });

      if (!updated) {
        return res.status(500).json({
          success: false,
          message: "Failed to update exam",
        });
      }

      const exam = await examModel.findExamById(id);
      res.json({
        success: true,
        message: "Exam updated successfully",
        data: exam,
      });
    } catch (error) {
      console.error("Error updating exam:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update exam",
        error: error.message,
      });
    }
  },

  // ✅ Simple direct delete - permanently removes from DB
  deleteExam: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if exam exists
      const existingExam = await examModel.findExamById(id);
      if (!existingExam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }

      const deleted = await examModel.deleteExam(id);
      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: "Failed to delete exam",
        });
      }

      res.json({
        success: true,
        message: "Exam deleted permanently",
      });
    } catch (error) {
      console.error("Error deleting exam:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete exam",
        error: error.message,
      });
    }
  },

  getAllExams: async (req, res) => {
    try {
      const { error, value } = examValidation.queryValidationSchema.validate(
        req.query,
      );
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      const result = await examModel.getPaginatedExams(value);
      res.json({
        success: true,
        data: result.exams,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching exams:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch exams",
        error: error.message,
      });
    }
  },

  getExamBySlug: async (req, res) => {
    try {
      const { slug } = req.params;
      const exam = await examModel.findExamBySlug(slug);
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }
      res.json({
        success: true,
        data: exam,
      });
    } catch (error) {
      console.error("Error fetching exam:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch exam",
        error: error.message,
      });
    }
  },

  getAdminExams: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 12,
        search = "",
        status = null,
        featured = null,
      } = req.query;

      const result = await examModel.getAdminPaginatedExams({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        status,
        featured: featured !== null ? featured === "true" : null,
      });

      res.json({
        success: true,
        data: result.exams,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching admin exams:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch exams",
        error: error.message,
      });
    }
  },

  updateExamStatus: async (req, res) => {
    try {
      const { id } = req.params;

      const { error, value } = examValidation.statusUpdateSchema.validate(
        req.body,
      );
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      const existingExam = await examModel.findExamById(id);
      if (!existingExam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }

      const updated = await examModel.updateExamStatus(id, value.status);
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: "Failed to update exam status",
        });
      }

      const exam = await examModel.findExamById(id);
      res.json({
        success: true,
        message: "Exam status updated successfully",
        data: exam,
      });
    } catch (error) {
      console.error("Error updating exam status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update exam status",
        error: error.message,
      });
    }
  },

  toggleFeaturedExam: async (req, res) => {
    try {
      const { id } = req.params;

      const { error, value } = examValidation.featuredUpdateSchema.validate(
        req.body,
      );
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      const existingExam = await examModel.findExamById(id);
      if (!existingExam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }

      const updated = await examModel.toggleFeatured(id, value.is_featured);
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: "Failed to update featured status",
        });
      }

      const exam = await examModel.findExamById(id);
      res.json({
        success: true,
        message: "Featured status updated successfully",
        data: exam,
      });
    } catch (error) {
      console.error("Error toggling featured exam:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update featured status",
        error: error.message,
      });
    }
  },

  getIndustries: async (req, res) => {
    try {
      const industries = await examModel.getIndustries();
      res.json({
        success: true,
        data: industries,
      });
    } catch (error) {
      console.error("Error fetching industries:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch industries",
        error: error.message,
      });
    }
  },

  getCategories: async (req, res) => {
    try {
      const { industryId } = req.query;
      if (!industryId) {
        return res.status(400).json({
          success: false,
          message: "Industry ID is required",
        });
      }
      const categories = await examModel.getCategoriesByIndustry(industryId);
      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch categories",
        error: error.message,
      });
    }
  },

  getSubcategories: async (req, res) => {
    try {
      const { categoryId } = req.query;
      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: "Category ID is required",
        });
      }
      const subcategories =
        await examModel.getSubcategoriesByCategory(categoryId);
      res.json({
        success: true,
        data: subcategories,
      });
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch subcategories",
        error: error.message,
      });
    }
  },

  getAnalytics: async (req, res) => {
    try {
      const { industryId } = req.query;
      const analytics = await examModel.getExamAnalytics(
        industryId ? parseInt(industryId) : null,
      );
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch analytics",
        error: error.message,
      });
    }
  },
};

module.exports = examController;
