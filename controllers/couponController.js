const Coupon = require('../models/Coupon');

const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  }
};

// @desc    Create new coupon
// @route   POST /api/coupons
// @access  Private/Admin
exports.createCoupon = async (req, res) => {
  try {
    const {
      discountPercentage,
      description,
      minPurchase,
      usageLimit,
      validFrom,
      validUntil
    } = req.body;

    logger.info('Creating new coupon', { discountPercentage, createdBy: req.user.id });

    // Generate unique coupon code
    const code = await Coupon.generateCouponCode(discountPercentage);

    const coupon = await Coupon.create({
      code,
      discountPercentage,
      description,
      minPurchase: minPurchase || 0,
      usageLimit: usageLimit || null,
      validFrom: validFrom || new Date(),
      validUntil,
      createdBy: req.user.id
    });

    logger.info('Coupon created successfully', { couponId: coupon._id, code: coupon.code });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    logger.error('Create coupon error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating coupon',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all coupons
// @route   GET /api/coupons
// @access  Private/Admin
exports.getCoupons = async (req, res) => {
  try {
    const { isActive, search, sort = '-createdAt', page = 1, limit = 20 } = req.query;

    const query = {};
    if (isActive === 'true') query.isActive = true;
    if (isActive === 'false') query.isActive = false;
    
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const coupons = await Coupon.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email');

    const total = await Coupon.countDocuments(query);

    const couponsWithStatus = coupons.map(coupon => ({
      ...coupon.toObject(),
      isValid: coupon.isValid(),
      usageLeft: coupon.usageLimit ? coupon.usageLimit - coupon.usedCount : 'Unlimited'
    }));

    const stats = {
      total: await Coupon.countDocuments(),
      active: await Coupon.countDocuments({ isActive: true }),
      expired: await Coupon.countDocuments({ validUntil: { $lt: new Date() }, isActive: true }),
      totalUsed: (await Coupon.aggregate([
        { $group: { _id: null, total: { $sum: '$usedCount' } } }
      ]))[0]?.total || 0
    };

    res.status(200).json({
      success: true,
      count: coupons.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      stats,
      coupons: couponsWithStatus
    });
  } catch (error) {
    logger.error('Get coupons error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching coupons'
    });
  }
};

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private/Admin
exports.updateCoupon = async (req, res) => {
  try {
    const { description, minPurchase, usageLimit, validFrom, validUntil, isActive } = req.body;
    
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    if (description) coupon.description = description;
    if (minPurchase !== undefined) coupon.minPurchase = minPurchase;
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
    if (validFrom) coupon.validFrom = validFrom;
    if (validUntil) coupon.validUntil = validUntil;
    if (isActive !== undefined) coupon.isActive = isActive;

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    logger.error('Update coupon error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating coupon'
    });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    await coupon.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    logger.error('Delete coupon error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting coupon'
    });
  }
};

// @desc    Toggle coupon status
// @route   PUT /api/coupons/:id/toggle
// @access  Private/Admin
exports.toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: coupon.isActive
    });
  } catch (error) {
    logger.error('Toggle coupon error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling coupon status'
    });
  }
};