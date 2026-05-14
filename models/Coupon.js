const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Please provide a coupon code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: [true, 'Please provide discount percentage'],
    enum: [10, 20, 30],
    min: 0,
    max: 100
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  minPurchase: {
    type: Number,
    default: 0,
    min: [0, 'Minimum purchase cannot be negative']
  },
  usageLimit: {
    type: Number,
    default: null,
    comment: 'Maximum number of times this coupon can be used'
  },
  usedCount: {
    type: Number,
    default: 0
  },
  validFrom: {
    type: Date,
    default: Date.now,
    required: [true, 'Please provide start date']
  },
  validUntil: {
    type: Date,
    required: [true, 'Please provide end date']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate random coupon code
couponSchema.statics.generateCouponCode = async function(discountPercentage) {
  const prefix = 'HS';
  const suffix = `${discountPercentage}`;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let isUnique = false;
  
  while (!isUnique) {
    // Generate 4 random characters
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code = `${prefix}${randomPart}${suffix}`;
    
    // Check if code exists
    const existingCoupon = await this.findOne({ code });
    if (!existingCoupon) {
      isUnique = true;
    }
  }
  
  return code;
};

// Check if coupon is valid
couponSchema.methods.isValid = function() {
  const now = new Date();
  const isWithinDateRange = now >= this.validFrom && now <= this.validUntil;
  const hasUsageLeft = this.usageLimit === null || this.usedCount < this.usageLimit;
  return this.isActive && isWithinDateRange && hasUsageLeft;
};

// Update updatedAt without next()
couponSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Coupon', couponSchema);