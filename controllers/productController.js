const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Logger utility
const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      sizes,
      category,
      gender,
      fragranceType,
      status,
      isFeatured,
      isBestSeller,
      tags,
      notes
    } = req.body;

    logger.info('Creating new product', { name, gender });

    // Check if product exists
    const productExists = await Product.findOne({ name });
    if (productExists) {
      return res.status(400).json({
        success: false,
        message: 'Product already exists with this name'
      });
    }

    // Parse sizes from JSON string if needed
    let parsedSizes = sizes;
    if (typeof sizes === 'string') {
      parsedSizes = JSON.parse(sizes);
    }

    // Upload main image to Cloudinary
    let mainImageUrl = null;
    if (req.files && req.files.mainImage) {
      const mainImageFile = req.files.mainImage[0];
      const b64 = Buffer.from(mainImageFile.buffer).toString('base64');
      const dataURI = `data:${mainImageFile.mimetype};base64,${b64}`;
      
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'hscents/products/main',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' }
        ]
      });
      mainImageUrl = result.secure_url;
    }

    // Upload more images to Cloudinary
    let moreImagesUrls = [];
    if (req.files && req.files.moreImages) {
      for (const file of req.files.moreImages) {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'hscents/products/more',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        moreImagesUrls.push(result.secure_url);
      }
    }

    // Create product
    const product = await Product.create({
      name,
      description,
      shortDescription,
      mainImage: mainImageUrl,
      moreImages: moreImagesUrls,
      sizes: parsedSizes,
      category,
      gender: gender || 'Unisex',
      fragranceType,
      status: status || 'active',
      isFeatured: isFeatured || false,
      isBestSeller: isBestSeller || false,
      tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
      notes
    });

    logger.info('Product created successfully', { productId: product._id, gender: product.gender });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    logger.error('Create product error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const { 
      category, 
      gender,
      status, 
      isFeatured, 
      isBestSeller,
      minPrice,
      maxPrice,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 10000
    } = req.query;

    // Build query
    const query = {};

    if (category) query.category = category;
    if (gender) query.gender = gender;
    if (status) query.status = status;
    if (isFeatured === 'true') query.isFeatured = true;
    if (isBestSeller === 'true') query.isBestSeller = true;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Price filtering (check if any size matches price range)
    if (minPrice || maxPrice) {
      query['sizes.price'] = {};
      if (minPrice) query['sizes.price'].$gte = parseFloat(minPrice);
      if (maxPrice) query['sizes.price'].$lte = parseFloat(maxPrice);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments(query);

    // Add stock status to each product
    const productsWithStatus = products.map(product => ({
      ...product.toObject(),
      stockStatus: product.getStockStatus(),
      availableSizes: product.getAvailableSizes(),
      lowStockSizes: product.getLowStockSizes(),
      genderIcon: product.getGenderIcon()
    }));

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      products: productsWithStatus
    });
  } catch (error) {
    logger.error('Get products error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product: {
        ...product.toObject(),
        stockStatus: product.getStockStatus(),
        availableSizes: product.getAvailableSizes(),
        lowStockSizes: product.getLowStockSizes(),
        genderIcon: product.getGenderIcon()
      }
    });
  } catch (error) {
    logger.error('Get product error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
exports.getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product: {
        ...product.toObject(),
        stockStatus: product.getStockStatus(),
        availableSizes: product.getAvailableSizes(),
        lowStockSizes: product.getLowStockSizes(),
        genderIcon: product.getGenderIcon()
      }
    });
  } catch (error) {
    logger.error('Get product by slug error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const {
      name,
      description,
      shortDescription,
      sizes,
      category,
      gender,
      fragranceType,
      status,
      isFeatured,
      isBestSeller,
      tags,
      notes
    } = req.body;

    // Update basic info
    if (name) product.name = name;
    if (description) product.description = description;
    if (shortDescription) product.shortDescription = shortDescription;
    if (category) product.category = category;
    if (gender) product.gender = gender;
    if (fragranceType) product.fragranceType = fragranceType;
    if (status) product.status = status;
    if (isFeatured !== undefined) product.isFeatured = isFeatured;
    if (isBestSeller !== undefined) product.isBestSeller = isBestSeller;
    if (tags) product.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (notes) product.notes = notes;

    // Update sizes if provided
    if (sizes) {
      product.sizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
    }

    // Update main image if new one uploaded
    if (req.files && req.files.mainImage) {
      const mainImageFile = req.files.mainImage[0];
      const b64 = Buffer.from(mainImageFile.buffer).toString('base64');
      const dataURI = `data:${mainImageFile.mimetype};base64,${b64}`;
      
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'hscents/products/main',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' }
        ]
      });
      product.mainImage = result.secure_url;
    }

    // Add more images if new ones uploaded
    if (req.files && req.files.moreImages) {
      for (const file of req.files.moreImages) {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'hscents/products/more',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        product.moreImages.push(result.secure_url);
      }
    }

    product.updatedAt = Date.now();
    await product.save();

    logger.info('Product updated successfully', { productId: product._id, gender: product.gender });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    logger.error('Update product error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update product stock (when order is placed)
// @route   PUT /api/products/:id/stock
// @access  Private/Admin
exports.updateStock = async (req, res) => {
  try {
    const { size, quantity } = req.body;
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const sizeIndex = product.sizes.findIndex(s => s.size === size);
    if (sizeIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Size not found for this product'
      });
    }

    // Update stock
    product.sizes[sizeIndex].stock -= quantity;
    
    if (product.sizes[sizeIndex].stock < 0) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${size}. Available: ${product.sizes[sizeIndex].stock + quantity}`
      });
    }

    product.updatedAt = Date.now();
    await product.save();

    // Check if low stock alert needed
    const isLowStock = product.sizes[sizeIndex].stock <= 5;
    
    logger.info('Stock updated', { 
      productId: product._id, 
      size, 
      newStock: product.sizes[sizeIndex].stock,
      lowStock: isLowStock 
    });

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      stock: product.sizes[sizeIndex].stock,
      isLowStock,
      product: {
        ...product.toObject(),
        stockStatus: product.getStockStatus(),
        availableSizes: product.getAvailableSizes(),
        lowStockSizes: product.getLowStockSizes(),
        genderIcon: product.getGenderIcon()
      }
    });
  } catch (error) {
    logger.error('Update stock error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating stock',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete images from Cloudinary (optional)
    // Extract public ID from URL and delete
    
    await product.deleteOne();

    logger.info('Product deleted successfully', { productId: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    logger.error('Delete product error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting product',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get products by gender
// @route   GET /api/products/gender/:gender
// @access  Public
exports.getProductsByGender = async (req, res) => {
  try {
    const { gender } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    if (!['Men', 'Women', 'Unisex'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender. Must be Men, Women, or Unisex'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find({ gender, status: 'active' })
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments({ gender, status: 'active' });

    const productsWithStatus = products.map(product => ({
      ...product.toObject(),
      stockStatus: product.getStockStatus(),
      availableSizes: product.getAvailableSizes(),
      genderIcon: product.getGenderIcon()
    }));

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      gender,
      products: productsWithStatus
    });
  } catch (error) {
    logger.error('Get products by gender error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products by gender',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get low stock products (for admin alerts)
// @route   GET /api/products/low-stock
// @access  Private/Admin
exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find();
    
    const lowStockProducts = products.filter(product => 
      product.getLowStockSizes().length > 0
    ).map(product => ({
      _id: product._id,
      name: product.name,
      gender: product.gender,
      lowStockSizes: product.getLowStockSizes(),
      mainImage: product.mainImage
    }));

    res.status(200).json({
      success: true,
      count: lowStockProducts.length,
      products: lowStockProducts
    });
  } catch (error) {
    logger.error('Get low stock products error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching low stock products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};