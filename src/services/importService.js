const ImportModel = require("../models/questionImportModel");
const StagingModel = require("../models/stagingQuestionModel");
const csvValidation = require("../validations/csvValidationService");
const questionHashService = require("../services/questionHashService");

exports.processImport = async (file, uploadedBy) => {
  // 1. Parse & Validate CSV
  const { validRows, invalidRows, stats } = csvValidation.parseAndValidateCSV(
    file.buffer,
    file,
  );

  // 2. Create Import Record
  const importId = await ImportModel.create({
    file_name: file.originalname,
    uploaded_by: uploadedBy,
    total_rows: stats.total,
    csv_valid_rows: stats.valid,
    csv_error_rows: stats.errors,
    csv_missing_rows: 0, // Handled within errors for simplicity
    csv_duplicate_rows: stats.duplicates,
    stage_history: "[]",
  });

  await ImportModel.updateStage(importId, "VALIDATED");

  // 3. Insert Valid Rows to Staging
  if (validRows.length > 0) {
    await StagingModel.insertBatch(validRows, importId, uploadedBy);
  }

  return { importId, stats, invalidRows, validCount: stats.valid };
};
