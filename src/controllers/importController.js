const importService = require("../services/importService");
const ImportModel = require("../models/questionImportModel");

exports.uploadToStaging = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No CSV file uploaded" });
    }

    const uploadedBy = req.headers["x-username"]?.trim() || "system";

    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(uploadedBy)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid username format. Use letters, numbers, underscores, or hyphens.",
      });
    }

    const result = await importService.processImport(req.file, uploadedBy);

    res.status(201).json({
      success: true,
      message: "Import staged successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const search = req.query.search?.toString().trim() || "";
    const stage = req.query.stage?.toString().trim() || "";
    const from = req.query.from?.toString().trim() || "";
    const to = req.query.to?.toString().trim() || "";

    const result = await ImportModel.getAll({
      page,
      limit,
      search,
      stage,
      from,
      to,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      filters: result.filters,
    });
  } catch (err) {
    next(err);
  }
};

exports.getImportDetails = async (req, res, next) => {
  try {
    const importData = await ImportModel.getById(req.params.import_id);
    if (!importData)
      return res
        .status(404)
        .json({ success: false, message: "Import batch not found" });

    res.json({ success: true, importData });
  } catch (err) {
    next(err);
  }
};
