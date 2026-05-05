const industryModel = require("../models/industryModel");
const { catchAsync, throwError } = require("../utils/errorHandler");
const { clearCache } = require("../middleware/cache");

// ==================== HELPER ====================
const transformToNested = (data) => {
  if (!data || data.length === 0) return [];

  const industriesMap = {};

  data.forEach((row) => {
    // Build Industry
    if (!industriesMap[row.industry_id]) {
      industriesMap[row.industry_id] = {
        id: row.industry_id,
        industry_name: row.industry_name,
        created_at: row.industry_created_at,
        categories: [],
      };
    }

    const industry = industriesMap[row.industry_id];

    // Build Category (if exists)
    if (row.category_id) {
      let category = industry.categories.find((c) => c.id === row.category_id);

      if (!category) {
        category = {
          id: row.category_id,
          category_name: row.category_name,
          created_at: row.category_created_at,
          subcategories: [],
        };
        industry.categories.push(category);
      }

      // Build Subcategory (if exists)
      if (row.subcategory_id) {
        category.subcategories.push({
          id: row.subcategory_id,
          sub_category_name: row.sub_category_name,
          created_at: row.subcategory_created_at,
        });
      }
    }
  });

  return Object.values(industriesMap);
};

// ==================== GET ALL (NESTED) ====================
exports.getAllIndustries = catchAsync(async (req, res, next) => {
  const data = await industryModel.getAllData();
  const nestedData = transformToNested(data);

  res.status(200).json({
    success: true,
    count: nestedData.length,
    nestedData,
  });
});

// ==================== INDUSTRY CRUD ====================
exports.createIndustry = catchAsync(async (req, res, next) => {
  const { industry_name } = req.body;

  if (!industry_name || industry_name.trim() === "") {
    return next(throwError("Industry name is required", 400));
  }

  const id = await industryModel.createIndustry(industry_name.trim());
  const industry = await industryModel.findIndustryById(id);

  clearCache("hierarchy"); // Invalidate cache

  res.status(201).json({
    success: true,
    industry,
  });
});

exports.updateIndustry = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { industry_name } = req.body;

  if (!industry_name || industry_name.trim() === "") {
    return next(throwError("Industry name is required", 400));
  }

  const existing = await industryModel.findIndustryById(id);
  if (!existing) {
    return next(throwError("Industry not found", 404));
  }

  await industryModel.updateIndustry(id, industry_name.trim());
  const updated = await industryModel.findIndustryById(id);

  clearCache("hierarchy");

  res.status(200).json({
    success: true,
    updated,
  });
});

exports.deleteIndustry = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const existing = await industryModel.findIndustryById(id);
  if (!existing) {
    return next(throwError("Industry not found", 404));
  }

  await industryModel.deleteIndustry(id);

  clearCache("hierarchy");

  res.status(204).json({
    success: true,
    message: "Industry deleted successfully",
  });
});

// ==================== CATEGORY CRUD ====================
exports.createCategory = catchAsync(async (req, res, next) => {
  const { category_name, industry_id } = req.body;

  if (!category_name || category_name.trim() === "") {
    return next(throwError("Category name is required", 400));
  }

  if (!industry_id) {
    return next(throwError("Industry ID is required", 400));
  }

  const industry = await industryModel.findIndustryById(industry_id);
  if (!industry) {
    return next(throwError("Industry not found", 404));
  }

  const id = await industryModel.createCategory(
    category_name.trim(),
    industry_id,
  );
  const category = await industryModel.findCategoryById(id);

  clearCache("hierarchy");

  res.status(201).json({
    success: true,
    category,
  });
});

exports.updateCategory = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { category_name } = req.body;

  if (!category_name || category_name.trim() === "") {
    return next(throwError("Category name is required", 400));
  }

  const existing = await industryModel.findCategoryById(id);
  if (!existing) {
    return next(throwError("Category not found", 404));
  }

  await industryModel.updateCategory(id, category_name.trim());
  const updated = await industryModel.findCategoryById(id);

  clearCache("hierarchy");

  res.status(200).json({
    success: true,
    updated,
  });
});

exports.deleteCategory = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const existing = await industryModel.findCategoryById(id);
  if (!existing) {
    return next(throwError("Category not found", 404));
  }

  await industryModel.deleteCategory(id);

  clearCache("hierarchy");

  res.status(204).json({
    success: true,
    message: "Category deleted successfully",
  });
});

// ==================== SUBCATEGORY CRUD ====================
exports.createSubcategory = catchAsync(async (req, res, next) => {
  const { sub_category_name, category_id } = req.body;

  if (!sub_category_name || sub_category_name.trim() === "") {
    return next(throwError("Subcategory name is required", 400));
  }

  if (!category_id) {
    return next(throwError("Category ID is required", 400));
  }

  const category = await industryModel.findCategoryById(category_id);
  if (!category) {
    return next(throwError("Category not found", 404));
  }

  const id = await industryModel.createSubcategory(
    sub_category_name.trim(),
    category_id,
  );
  const subcategory = await industryModel.findSubcategoryById(id);

  clearCache("hierarchy");

  res.status(201).json({
    success: true,
    subcategory,
  });
});

exports.updateSubcategory = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { sub_category_name } = req.body;

  if (!sub_category_name || sub_category_name.trim() === "") {
    return next(throwError("Subcategory name is required", 400));
  }

  const existing = await industryModel.findSubcategoryById(id);
  if (!existing) {
    return next(throwError("Subcategory not found", 404));
  }

  await industryModel.updateSubcategory(id, sub_category_name.trim());
  const updated = await industryModel.findSubcategoryById(id);

  clearCache("hierarchy");

  res.status(200).json({
    success: true,
    updated,
  });
});

exports.deleteSubcategory = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const existing = await industryModel.findSubcategoryById(id);
  if (!existing) {
    return next(throwError("Subcategory not found", 404));
  }

  await industryModel.deleteSubcategory(id);

  clearCache("hierarchy");

  res.status(204).json({
    success: true,
    message: "Subcategory deleted successfully",
  });
});
