const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
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
  deleteUser
} = require('../controllers/authController');

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
// Add this route with your other private routes
router.put('/update-profile', protect, upload.single('profileImage'), updateProfile);

// Admin routes (add admin middleware later)
router.get('/users', protect, getAllUsers); // Add admin check
router.get('/users/:id', protect, getUserById); // Add admin check
router.delete('/users/:id', protect, deleteUser); // Add admin check

module.exports = router;