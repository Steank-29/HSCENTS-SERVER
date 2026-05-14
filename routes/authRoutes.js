const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const {
  register,
  login,
  verifyIdentity,
  verifyOTP,
  resetPassword,
  resendOTP,
  getMe,
  updateProfile,
  getAllUsers,
  getUserById,
  deleteUser,
  getAdminUsers
} = require('../controllers/authController');

// Super Admin middleware - fixed without next parameter issue
const isSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    if (user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super Admin privileges required.'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while checking permissions'
    });
  }
};

// Public routes
router.post('/register', upload.single('profileImage'), register);
router.post('/login', login);
router.post('/forgot-password/verify-identity', verifyIdentity);
router.post('/forgot-password/verify-otp', verifyOTP);
router.post('/forgot-password/reset-password', resetPassword);
router.post('/forgot-password/resend-otp', resendOTP);

// Private routes (authenticated users)
router.get('/me', protect, getMe);
router.put('/update-profile', protect, upload.single('profileImage'), updateProfile);

// Admin routes
router.get('/users', protect, getAllUsers);
router.get('/users/:id', protect, getUserById);
router.delete('/users/:id', protect, isSuperAdmin, deleteUser);
router.get('/admins', protect, isSuperAdmin, getAdminUsers);

module.exports = router;