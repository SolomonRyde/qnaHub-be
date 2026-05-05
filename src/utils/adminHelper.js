export const validateDeletion = (currentUser, targetUsers) => {
  const superAdminId = parseInt(process.env.SUPER_ADMIN_ID);

  for (const user of targetUsers) {
    // ❌ Prevent self delete
    if (user.id === currentUser.id) {
      throwError('You cannot delete yourself', 400);
    }

    // ❌ Prevent deleting super admin
    if (user.id === superAdminId) {
      throwError('Super admin cannot be deleted', 403);
    }

    // ❌ Admin cannot delete admin
    if (
      currentUser.id !== superAdminId &&
      user.role === 'admin'
    ) {
      throwError('You cannot delete admin users', 403);
    }
  }
};

export const validateRestore = (currentUser, targetUsers) => {
  const superAdminId = parseInt(process.env.SUPER_ADMIN_ID);

  for (const user of targetUsers) {

    // ❌ Prevent restoring super admin (optional but recommended)
    if (user.id === superAdminId) {
      throwError('Super admin cannot be restored manually', 403);
    }

    // ❌ Admin cannot restore admin
    if (
      currentUser.id !== superAdminId &&
      user.role === 'admin'
    ) {
      throwError('You cannot restore admin users', 403);
    }

    // ❌ Optional: prevent restoring already active users
    if (user.is_deleted === 0) {
      throwError('User is already active', 400);
    }
  }
};
