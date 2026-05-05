const { catchAsync, throwError } = require('../utils/errorHandler');
const User = require('../models/userModel');
const { validateDeletion, validateRestore } = require('../utils/adminHelper');

exports.getDashboardStats = catchAsync(async (req, res) => {

  const stats = await User.getUserStats();

  if (!stats) {
    throwError('Failed to fetch dashboard stats', 500);
  }

  res.status(200).json({
    success: true,
    data: stats
  });
});



exports.getAllUsers = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    role,
    status,
    verified,
    deleted
  } = req.query;

  const result = await User.getAllUsers({
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    role,
    status,
    verified,
    deleted
  });

  if (!result) {
    throwError('Failed to fetch users', 500);
  }

  res.status(200).json({
    success: true,
    ...result
  });
});



exports.getSingleUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await User.getUserById(id);

  if (!user) {
    throwError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    data: user
  });
});




// 🟡 SOFT DELETE
exports.softDeleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const targetUser = await User.findById(id);
  if (!targetUser) throwError('User not found', 404);

  validateDeletion(req.user, [targetUser]);

  const result = await User.softDeleteUser(id);

  if (!result.affectedRows) {
    throwError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'User deactivated (soft deleted)'
  });
});


// 🔴 HARD DELETE
exports.hardDeleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const targetUser = await User.findById(id);
  if (!targetUser) throwError('User not found', 404);
  validateDeletion(req.user, [targetUser]);

  const result = await User.hardDeleteUser(id);

  if (!result.affectedRows) {
    throwError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'User permanently deleted'
  });
});


// 🟡 BULK SOFT DELETE
exports.bulkSoftDeleteUsers = catchAsync(async (req, res) => {
  const { userIds } = req.body || {};

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throwError('User IDs are required', 400);
  }

const users = await User.getUsersByIds(userIds);

  validateDeletion(req.user, users);

  const result = await User.bulkSoftDeleteUsers(userIds);

  res.json({
    success: true,
    message: `${result.affectedRows} users soft deleted`
  });
});


// 🔴 BULK HARD DELETE
exports.bulkHardDeleteUsers = catchAsync(async (req, res) => {
  const { userIds } = req.body || {};

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throwError('User IDs are required', 400);
  }
  const users = await User.getUsersByIds(userIds);
  validateDeletion(req.user, users);

  const result = await User.bulkHardDeleteUsers(userIds);

  res.json({
    success: true,
    message: `${result.affectedRows} users permanently deleted`
  });
});





// 🟢 SINGLE RESTORE
exports.restoreUser = catchAsync(async (req, res) => {
  const { id } = req.params;

const targetUser = await User.findById(id);
validateRestore(req.user, [targetUser]);

  const result = await User.restoreUser(id);

  if (!result.affectedRows) {
    throwError('User not found or already active', 404);
  }

  res.json({
    success: true,
    message: 'User restored successfully'
  });
});


// 🟢 BULK RESTORE
exports.bulkRestoreUsers = catchAsync(async (req, res) => {
  const { userIds } = req.body || {};

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throwError('User IDs are required', 400);
  }
  if (userIds.includes(req.user.id)) {
  throwError('You cannot modify your own account', 400);
}
const users = await User.getUsersByIds(userIds);
validateRestore(req.user, users);

  const result = await User.bulkRestoreUsers(userIds);

  res.json({
    success: true,
    message: `${result.affectedRows} users restored`
  });
});



exports.updateUserRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const currentUserId = req.user.id;
  const superAdminId = parseInt(process.env.SUPER_ADMIN_ID);

  if (!role) {
    throwError('Role is required', 400);
  }

  const allowedRoles = ['user', 'staff', 'admin'];
  const targetUser = await User.getUserById(id);

  if (!targetUser) {
    throwError('User not found', 404);
  }

  // 🚫 Prevent self role change
  if (currentUserId === targetUser.id) {
    throwError('You cannot change your own role', 400);
  }

  // 🔥 MAIN LOGIC

  if (currentUserId !== superAdminId) {
    // 👉 Normal admin

    if (targetUser.role !== 'staff' && targetUser.role !== 'user') {
      throwError('You can only manage staff users', 403);
    }

    if (!['staff', 'user'].includes(role)) {
      throwError('You can only promote/demote staff ↔ user', 403);
    }
  }

  // 👉 Super admin can do anything

if (!allowedRoles.includes(role)) {
  throwError('Invalid role only use these three roles: user, staff, admin', 400);
}
  await User.updateUserRole(id, role);

  res.json({
    success: true,
    message: 'User role updated successfully'
  });
});