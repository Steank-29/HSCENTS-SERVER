const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
  size: {
    type: String,
    required: [true, 'Please add size'],
    enum: ['5ml','10ml','30ml', '50ml', '100ml', '200ml', '500ml']
  },
  price: {
    type: Number,
    required: [true, 'Please add price for this size'],
    min: [0, 'Price cannot be negative']
  },
  stock: {
    type: Number,
    required: [true, 'Please add stock quantity'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  }
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add product name'],
    trim: true,
    unique: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    lowercase: true,
    unique: true
  },
  description: {
    type: String,
    required: [false, 'Please add product description'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  mainImage: {
    type: String,
    required: [true, 'Please add main product image']
  },
  moreImages: [{
    type: String
  }],
  sizes: [sizeSchema],
  category: {
    type: String,
    required: [true, 'Please add product category'],
    enum: ['Niche', 'Designer', 'Arab']
  },
  gender: {
    type: String,
    required: [true, 'Please specify gender'],
    enum: ['Men', 'Women', 'Unisex'],
    default: 'Unisex'
  },
fragranceType: {
  type: String,
  enum: [
    'Eau de Parfum',
    'Eau de Toilette',
    'Eau de Cologne',
    'Extrait de Parfum',
    'Eau Fraîche',
    'Parfum Oil',
    'Hair Mist',
    'Body Mist',
    'Solid Perfume',
    'Intense Eau de Parfum',
    'Elixir',
    'Parfum Absolu'
  ]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'coming-soon', 'discontinued'],
    default: 'active'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isBestSeller: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
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

// Generate slug from name before saving (without next)
productSchema.pre('save', async function() {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  this.updatedAt = Date.now();
});

// Generate SKU for each size
productSchema.pre('save', async function() {
  if (this.isModified('sizes') || this.isNew) {
    this.sizes.forEach((size) => {
      if (!size.sku) {
        const prefix = this.name.substring(0, 3).toUpperCase();
        const genderCode = this.gender === 'Men' ? 'M' : this.gender === 'Women' ? 'W' : 'U';
        const sizeCode = size.size.replace('ml', '');
        const randomNum = Math.floor(Math.random() * 1000);
        size.sku = `${prefix}-${genderCode}-${sizeCode}-${randomNum}`;
      }
    });
  }
});

// Method to check if product has low stock
productSchema.methods.getLowStockSizes = function() {
  return this.sizes.filter(size => size.stock <= 5 && size.stock > 0);
};

// Method to check if product is out of stock
productSchema.methods.isOutOfStock = function() {
  return this.sizes.every(size => size.stock === 0);
};

// Method to get available sizes
productSchema.methods.getAvailableSizes = function() {
  return this.sizes.filter(size => size.stock > 0);
};

// Method to get stock status
productSchema.methods.getStockStatus = function() {
  const totalStock = this.sizes.reduce((sum, size) => sum + size.stock, 0);
  if (totalStock === 0) return 'out-of-stock';
  if (totalStock <= 10) return 'low-stock';
  return 'in-stock';
};

// Method to get gender icon/display
productSchema.methods.getGenderIcon = function() {
  const icons = {
    'Men': '👨',
    'Women': '👩',
    'Unisex': '👥'
  };
  return icons[this.gender] || '👥';
};

module.exports = mongoose.model('Product', productSchema);