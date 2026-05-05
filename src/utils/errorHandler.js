const { AppError } = require('../middleware/errorHandler');

exports.catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

exports.throwError = (message, statusCode = 500) => {
  throw new AppError(message, statusCode);
};