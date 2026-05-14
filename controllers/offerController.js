const Offer = require('../models/Offer');
const cloudinary = require('../config/cloudinary');

const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  }
};

// @desc    Create new offer
// @route   POST /api/offers
// @access  Private/Admin
exports.createOffer = async (req, res) => {
  try {
    const {
      name,
      description,
      shortDescription,
      sizes,
      tag,
      startDate,
      endDate,
      isFeatured,
      discountPercentage
    } = req.body;

    logger.info('Creating new offer', { name, createdBy: req.user.id });

    // Check if offer exists
    const offerExists = await Offer.findOne({ name });
    if (offerExists) {
      return res.status(400).json({
        success: false,
        message: 'Offer already exists with this name'
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
        folder: 'hscents/offers/main',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' }
        ]
      });
      mainImageUrl = result.secure_url;
    }

    // Upload more images
    let moreImagesUrls = [];
    if (req.files && req.files.moreImages) {
      for (const file of req.files.moreImages) {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'hscents/offers/more',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        moreImagesUrls.push(result.secure_url);
      }
    }

    // Create offer
    const offer = await Offer.create({
      name,
      description,
      shortDescription,
      mainImage: mainImageUrl,
      moreImages: moreImagesUrls,
      sizes: parsedSizes,
      tag: tag || 'Limited Time',
      startDate,
      endDate,
      isFeatured: isFeatured || false,
      discountPercentage: discountPercentage || null,
      createdBy: req.user.id
    });

    logger.info('Offer created successfully', { offerId: offer._id });

    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      offer
    });
  } catch (error) {
    logger.error('Create offer error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating offer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all offers
// @route   GET /api/offers
// @access  Public/Admin
exports.getOffers = async (req, res) => {
  try {
    const {
      isActive,
      status,
      tag,
      isFeatured,
      sort = '-createdAt',
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    
    if (isActive === 'true') query.isActive = true;
    if (isActive === 'false') query.isActive = false;
    if (status) query.status = status;
    if (tag) query.tag = tag;
    if (isFeatured === 'true') query.isFeatured = true;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const offers = await Offer.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email');

    const total = await Offer.countDocuments(query);

    const offersWithStatus = offers.map(offer => ({
      ...offer.toObject(),
      isCurrentlyActive: offer.isCurrentlyActive(),
      statusText: offer.getStatusText(),
      timeRemaining: offer.getTimeRemaining()
    }));

    // Get statistics
    const stats = {
      total: await Offer.countDocuments(),
      active: await Offer.countDocuments({ status: 'active' }),
      expired: await Offer.countDocuments({ status: 'expired' }),
      comingSoon: await Offer.countDocuments({ status: 'coming-soon' }),
      featured: await Offer.countDocuments({ isFeatured: true })
    };

    res.status(200).json({
      success: true,
      count: offers.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      stats,
      offers: offersWithStatus
    });
  } catch (error) {
    logger.error('Get offers error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offers'
    });
  }
};

// @desc    Get single offer
// @route   GET /api/offers/:id
// @access  Public
exports.getOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate('createdBy', 'name email');
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    res.status(200).json({
      success: true,
      offer: {
        ...offer.toObject(),
        isCurrentlyActive: offer.isCurrentlyActive(),
        statusText: offer.getStatusText(),
        timeRemaining: offer.getTimeRemaining()
      }
    });
  } catch (error) {
    logger.error('Get offer error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offer'
    });
  }
};

// @desc    Update offer
// @route   PUT /api/offers/:id
// @access  Private/Admin
exports.updateOffer = async (req, res) => {
  try {
    let offer = await Offer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    const {
      name,
      description,
      shortDescription,
      sizes,
      tag,
      startDate,
      endDate,
      isActive,
      isFeatured,
      discountPercentage
    } = req.body;

    if (name) offer.name = name;
    if (description) offer.description = description;
    if (shortDescription) offer.shortDescription = shortDescription;
    if (tag) offer.tag = tag;
    if (startDate) offer.startDate = startDate;
    if (endDate) offer.endDate = endDate;
    if (isActive !== undefined) offer.isActive = isActive;
    if (isFeatured !== undefined) offer.isFeatured = isFeatured;
    if (discountPercentage !== undefined) offer.discountPercentage = discountPercentage;

    if (sizes) {
      offer.sizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
    }

    // Update main image
    if (req.files && req.files.mainImage) {
      const mainImageFile = req.files.mainImage[0];
      const b64 = Buffer.from(mainImageFile.buffer).toString('base64');
      const dataURI = `data:${mainImageFile.mimetype};base64,${b64}`;
      
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'hscents/offers/main',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' }
        ]
      });
      offer.mainImage = result.secure_url;
    }

    // Add more images
    if (req.files && req.files.moreImages) {
      for (const file of req.files.moreImages) {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'hscents/offers/more',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' }
          ]
        });
        offer.moreImages.push(result.secure_url);
      }
    }

    await offer.save();

    logger.info('Offer updated successfully', { offerId: offer._id });

    res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      offer
    });
  } catch (error) {
    logger.error('Update offer error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating offer'
    });
  }
};

// @desc    Delete offer
// @route   DELETE /api/offers/:id
// @access  Private/Admin
exports.deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    await offer.deleteOne();

    logger.info('Offer deleted successfully', { offerId: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Offer deleted successfully'
    });
  } catch (error) {
    logger.error('Delete offer error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting offer'
    });
  }
};

// @desc    Toggle offer status
// @route   PUT /api/offers/:id/toggle
// @access  Private/Admin
exports.toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    res.status(200).json({
      success: true,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: offer.isActive
    });
  } catch (error) {
    logger.error('Toggle offer error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling offer status'
    });
  }
};

// @desc    Get active offers for frontend
// @route   GET /api/offers/active
// @access  Public
exports.getActiveOffers = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: offers.length,
      offers
    });
  } catch (error) {
    logger.error('Get active offers error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching active offers'
    });
  }
};