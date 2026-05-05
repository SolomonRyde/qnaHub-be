const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler'); // adjust path
const { catchAsync } = require('../utils/errorHandler');
const User = require('../models/userModel'); // adjust path

exports.authenticateToken = catchAsync(async (req, res, next) => {
  // ✅ get token from cookie
  
let token = req.cookies?.authToken;

if (!token && req.headers.authorization) {
  const parts = req.headers.authorization.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    token = parts[1];
  }
}

  if (!token) {
    return next(new AppError('Access token required', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 🔥 IMPORTANT: fetch latest user state
    const currentuser = await User.findById(decoded.id);

    if (!currentuser) {
      return next(new AppError('User not found', 404));
    }

    if (currentuser.is_deleted) {
      return next(new AppError('Account deleted by admin', 403));
    }

    if (currentuser.status !== 1) {
      return next(new AppError('Account inactive', 403));
    }

    req.user = currentuser;
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
});



exports.authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Unauthorized', 401));
  }

  if (req.user.role !== 'admin') {
    return next(new AppError('Access denied: Admins only', 403));
  }

  next();
};