const multer = require("multer");

// Memory storage - no disk writes
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Validate PDF
  if (file.mimetype === 'application/pdf' && file.originalname.endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"));
  }
};

const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024  // 20MB limit
  },
  fileFilter
});

module.exports = { uploadPdf };
