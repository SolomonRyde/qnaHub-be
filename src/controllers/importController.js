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

    // ✅ FIX: Updated regex to allow spaces, dots (.), and @ (for emails) up to 100 chars
    if (!/^[a-zA-Z0-9_\-@.\s]{3,100}$/.test(uploadedBy)) {
      return res.status(400).json({
        success: false,
        message: "Invalid username format. Max 100 characters allowed.",
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

/**
 * ✅ NEW: Delete an import batch
 */
exports.deleteImport = async (req, res, next) => {
  try {
    const importId = parseInt(req.params.import_id);
    if (isNaN(importId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid import ID" });
    }

    const affected = await ImportModel.delete(importId);

    if (affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Import batch not found" });
    }

    res.json({
      success: true,
      message:
        "Import batch and associated staging questions deleted successfully",
      data: { deletedCount: affected },
    });
  } catch (err) {
    next(err);
  }
};
