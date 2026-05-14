const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const generateOTP = require('../utils/generateOTP');
const cloudinary = require('../config/cloudinary');

// Logger utility
const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  },
  warn: (message, data = null) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? data : '');
  }
};

// Generate JWT Token
const generateToken = (userId, expiresIn = null) => {
  const expiry = expiresIn || process.env.JWT_EXPIRE;
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: expiry
  });
};

// Sanitize user data for response
const sanitizeUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    dateOfBirth: user.dateOfBirth,
    profileImage: user.profileImage,
    isVerified: user.isVerified,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    role: user.role || 'admin'
  };
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, dateOfBirth } = req.body;

    logger.info('Registration attempt', { email, name });

    // Validation
    if (!name || !email || !password || !dateOfBirth) {
      logger.warn('Missing registration fields', { name, email, dateOfBirth });
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, dateOfBirth'
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      logger.warn('User already exists', { email });
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    let profileImageUrl = null;
    
    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        logger.info('Uploading profile image to Cloudinary', { email });
        
        // Convert buffer to base64 for Cloudinary (since we're using memory storage)
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'hscents/profiles',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        profileImageUrl = result.secure_url;
        logger.info('Cloudinary upload successful', { email, url: profileImageUrl });
      } catch (uploadError) {
        logger.error('Cloudinary upload error', uploadError);
        // Continue without profile image if upload fails
      }
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      dateOfBirth,
      profileImage: profileImageUrl,
      isVerified: false,
      role: 'admin'
    });

    logger.info('User registered successfully', { userId: user._id, email });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    logger.error('Registration error', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    logger.info('Login attempt', { email });

    // Validate email & password
    if (!email || !password) {
      logger.warn('Missing login credentials', { email });
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      logger.warn('User not found', { email });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked (optional: add lock after failed attempts)
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      logger.warn('Account locked', { email, lockedUntil: user.lockedUntil });
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      logger.warn('Invalid password', { email });
      
      // Track failed attempts (optional)
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
        logger.warn('Account locked due to multiple failed attempts', { email });
      }
      await user.save({ validateBeforeSave: false });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Generate token with different expiry based on remember me
    const tokenExpiry = rememberMe ? '30d' : process.env.JWT_EXPIRE;
    const token = generateToken(user._id, tokenExpiry);

    logger.info('User logged in successfully', { userId: user._id, email });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Verify identity and send OTP for password reset
// @route   POST /api/auth/forgot-password/verify-identity
// @access  Public
exports.verifyIdentity = async (req, res) => {
  try {
    const { email, dateOfBirth } = req.body;

    logger.info('Password reset identity verification', { email });

    if (!email || !dateOfBirth) {
      logger.warn('Missing identity verification fields', { email });
      return res.status(400).json({
        success: false,
        message: 'Please provide email and date of birth'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn('User not found for password reset', { email });
      return res.status(404).json({
        success: false,
        message: 'No user found with this email'
      });
    }

    // Verify date of birth
    const userDOB = new Date(user.dateOfBirth).toISOString().split('T')[0];
    if (userDOB !== dateOfBirth) {
      logger.warn('Date of birth mismatch', { email });
      return res.status(400).json({
        success: false,
        message: 'Date of birth does not match our records'
      });
    }

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email });

    // Generate OTP
    const otp = generateOTP();
    
    // Save OTP in database
    await OTP.create({
      email,
      otp
    });

    logger.info('OTP generated and saved', { email, otp: '******' });

    // Send OTP via email
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0a1928 0%, #1e3a5f 100%); padding: 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .otp-code { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 36px; letter-spacing: 8px; font-weight: bold; border-radius: 10px; margin: 20px 0; font-family: monospace; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background-color: #1e3a5f; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .warning { color: #dc3545; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 ${process.env.APP_NAME}</h1>
          </div>
          <div class="content">
            <h2 style="color: #1e3a5f; margin-top: 0;">Password Reset Request</h2>
            <p>Dear <strong>${user.name}</strong>,</p>
            <p>We received a request to reset your password for your ${process.env.APP_NAME} account. Use the following OTP code to verify your identity:</p>
            <div class="otp-code">${otp}</div>
            <p>This OTP is valid for <strong>10 minutes</strong> from the time of this email.</p>
            <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
            <div class="warning">
              ⚠️ For security reasons, never share this OTP with anyone, including our support team.
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME}. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      email: user.email,
      subject: `Password Reset OTP - ${process.env.APP_NAME}`,
      html: emailContent
    });

    logger.info('OTP email sent successfully', { email });

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox (and spam folder).'
    });
  } catch (error) {
    logger.error('Identity verification error', error);
    res.status(500).json({
      success: false,
      message: 'Server error during identity verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/forgot-password/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    logger.info('OTP verification attempt', { email, otpLength: otp?.length });

    if (!email || !otp) {
      logger.warn('Missing OTP verification fields', { email });
      return res.status(400).json({
        success: false,
        message: 'Please provide email and OTP code'
      });
    }

    // Find OTP in database
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      logger.warn('Invalid or expired OTP', { email });
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new code.'
      });
    }

    // Delete OTP after verification
    await otpRecord.deleteOne();

    // Generate temporary reset token
    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: '15m'
    });

    logger.info('OTP verified successfully', { email });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      resetToken
    });
  } catch (error) {
    logger.error('OTP verification error', error);
    res.status(500).json({
      success: false,
      message: 'Server error during OTP verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/forgot-password/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    logger.info('Password reset attempt');

    if (!resetToken || !newPassword) {
      logger.warn('Missing password reset fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide reset token and new password'
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (error) {
      logger.warn('Invalid or expired reset token');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Find user and update password
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      logger.warn('User not found after token verification', { email: decoded.email });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info('Password reset successful', { userId: user._id, email: user.email });

    // Send confirmation email
    const confirmationEmail = `
      <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0a1928 0%, #1e3a5f 100%); padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">${process.env.APP_NAME}</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <h2 style="color: #1e3a5f;">Password Reset Successful</h2>
          <p>Dear ${user.name},</p>
          <p>Your password has been successfully reset.</p>
          <p>If you did not perform this action, please contact our support team immediately.</p>
          <p>You can now login to your account with your new password.</p>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px; text-align: center;">${process.env.APP_NAME} - Security Team</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: `Password Reset Successful - ${process.env.APP_NAME}`,
      html: confirmationEmail
    }).catch(emailError => {
      logger.error('Failed to send confirmation email', emailError);
      // Don't fail the request if confirmation email fails
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    logger.error('Password reset error', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/forgot-password/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    logger.info('OTP resend request', { email });

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email address'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn('User not found for OTP resend', { email });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old OTPs
    await OTP.deleteMany({ email });

    // Generate new OTP
    const otp = generateOTP();
    
    // Save new OTP
    await OTP.create({
      email,
      otp
    });

    logger.info('New OTP generated and saved', { email, otp: '******' });

    // Send new OTP
    const emailContent = `
      <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0a1928 0%, #1e3a5f 100%); padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">${process.env.APP_NAME}</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <h2 style="color: #1e3a5f;">New Password Reset OTP</h2>
          <p>Dear ${user.name},</p>
          <p>You requested a new OTP for password reset. Your new verification code is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; border-radius: 10px;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px; text-align: center;">${process.env.APP_NAME} - Security Team</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: `New Password Reset OTP - ${process.env.APP_NAME}`,
      html: emailContent
    });

    logger.info('New OTP email sent', { email });

    res.status(200).json({
      success: true,
      message: 'New OTP sent to your email'
    });
  } catch (error) {
    logger.error('OTP resend error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resending OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      logger.warn('User not found in getMe', { userId: req.user.id });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User profile retrieved', { userId: user._id });

    res.status(200).json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    logger.error('Get user error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update user profile (Admin/User)
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, dateOfBirth } = req.body;
    const userId = req.user.id;

    logger.info('Profile update attempt', { userId });

    const updateData = {};
    if (name) updateData.name = name;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;

    // Handle profile image update
    if (req.file) {
      try {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'hscents/profiles',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        updateData.profileImage = result.secure_url;
        logger.info('Profile image updated', { userId, url: result.secure_url });
      } catch (uploadError) {
        logger.error('Profile image upload error', uploadError);
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    logger.info('Profile updated successfully', { userId });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizeUser(user)
    });
  } catch (error) {
    logger.error('Profile update error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    logger.info('Fetching all users', { requestedBy: req.user.id });

    const users = await User.find().select('-password').sort({ createdAt: -1 });

    logger.info(`Retrieved ${users.length} users`);

    res.status(200).json({
      success: true,
      count: users.length,
      users: users.map(sanitizeUser)
    });
  } catch (error) {
    logger.error('Get all users error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/auth/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      logger.warn('User not found', { userId: req.params.id });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User retrieved', { userId: req.params.id });

    res.status(200).json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (error) {
    logger.error('Get user by ID error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all admin users (Super Admin only)
// @route   GET /api/auth/admins
// @access  Private/SuperAdmin
exports.getAdminUsers = async (req, res) => {
  try {
    logger.info('Fetching admin users', { requestedBy: req.user.id });

    // Get users with role 'admin' only (not super_admin)
    const admins = await User.find({ role: 'admin' }).select('-password').sort({ createdAt: -1 });

    logger.info(`Retrieved ${admins.length} admin users`);

    res.status(200).json({
      success: true,
      count: admins.length,
      admins: admins.map(sanitizeUser)
    });
  } catch (error) {
    logger.error('Get admin users error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admin users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete user (Super Admin only - can delete admins)
// @route   DELETE /api/auth/users/:id
// @access  Private/SuperAdmin
exports.deleteUser = async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!userToDelete) {
      logger.warn('User not found for deletion', { userId: req.params.id });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if trying to delete own account
    if (userToDelete._id.toString() === currentUser._id.toString()) {
      logger.warn('User attempted to delete own account', { userId: req.params.id });
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Check permissions: Only super_admin can delete admins or other super_admins
    if (userToDelete.role === 'admin' || userToDelete.role === 'super_admin') {
      if (currentUser.role !== 'super_admin') {
        logger.warn('Non-super admin attempted to delete admin', { 
          currentUser: currentUser.role, 
          targetUser: userToDelete.role 
        });
        return res.status(403).json({
          success: false,
          message: 'Only Super Admin can delete admin accounts'
        });
      }
    }

    // Delete user's profile image from Cloudinary if exists
    if (userToDelete.profileImage) {
      const publicId = userToDelete.profileImage.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId).catch(err => {
        logger.error('Failed to delete image from Cloudinary', err);
      });
    }

    await userToDelete.deleteOne();

    logger.info('User deleted successfully', { 
      userId: req.params.id, 
      deletedBy: currentUser.id,
      deletedUserRole: userToDelete.role
    });

    res.status(200).json({
      success: true,
      message: `User ${userToDelete.name} has been deleted successfully`
    });
  } catch (error) {
    logger.error('Delete user error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, dateOfBirth } = req.body;
    const userId = req.user.id;

    logger.info('Profile update attempt', { userId });

    const updateData = {};
    if (name) updateData.name = name;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;

    // Handle profile image update
    if (req.file) {
      try {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'hscents/profiles',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        updateData.profileImage = result.secure_url;
      } catch (uploadError) {
        logger.error('Profile image upload error', uploadError);
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        profileImage: user.profileImage,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    logger.error('Profile update error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};