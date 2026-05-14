const mongoose = require('mongoose');

const offerSizeSchema = new mongoose.Schema({
  size: {
    type: String,
    required: [true, 'Please add size'],
    enum: ['5ml', '10ml', '30ml', '50ml', '100ml']
  },
  price: {
    type: Number,
    required: [true, 'Please add price for this size'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  }
});

const offerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add offer name'],
    trim: true,
    unique: true,
    maxlength: [100, 'Offer name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    lowercase: true,
    unique: true
  },
  description: {
    type: String,
    required: [false, 'Please add offer description'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  category: {
    type: String,
    default: 'Offer',
    enum: ['Offer']
  },
  tag: {
    type: String,
    required: [true, 'Please add a tag for the offer'],
    enum: ['Summer Sale', 'Winter Sale', 'Black Friday', 'Flash Sale', 'Limited Time', 'Clearance', 'New Year', 'Holiday Special'],
    default: 'Limited Time'
  },
  sizes: [offerSizeSchema],
  mainImage: {
    type: String,
    required: [true, 'Please add main offer image']
  },
  moreImages: [{
    type: String
  }],
  startDate: {
    type: Date,
    required: [true, 'Please provide start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please provide end date']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'coming-soon'],
    default: 'active'
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

// Generate slug from name
offerSchema.pre('save', async function() {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  this.updatedAt = Date.now();
  
  // Auto-update status based on dates
  const now = new Date();
  if (now < this.startDate) {
    this.status = 'coming-soon';
  } else if (now > this.endDate) {
    this.status = 'expired';
  } else if (this.isActive && now >= this.startDate && now <= this.endDate) {
    this.status = 'active';
  }
});

// Check if offer is currently active
offerSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
};

// Get offer status text
offerSchema.methods.getStatusText = function() {
  const now = new Date();
  if (now < this.startDate) return 'Coming Soon';
  if (now > this.endDate) return 'Expired';
  if (!this.isActive) return 'Inactive';
  return 'Active';
};

// Get time remaining
offerSchema.methods.getTimeRemaining = function() {
  const now = new Date();
  if (now > this.endDate) return 'Expired';
  const diff = this.endDate - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} days ${hours} hours`;
  return `${hours} hours`;
};

module.exports = mongoose.model('Offer', offerSchema);