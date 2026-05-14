const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const {
  createProduct,
  getProducts,
  getProduct,
  getProductBySlug,
  updateProduct,
  updateStock,
  deleteProduct,
  getLowStockProducts,
  getProductsByGender
} = require('../controllers/productController');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Public routes
router.get('/', getProducts);
router.get('/low-stock', protect, getLowStockProducts); // Admin only
router.get('/slug/:slug', getProductBySlug);
router.get('/:id', getProduct);
router.get('/gender/:gender', getProductsByGender);

// Admin routes
router.post(
  '/',
  protect,
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'moreImages', maxCount: 10 }
  ]),
  createProduct
);

router.put(
  '/:id',
  protect,
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'moreImages', maxCount: 10 }
  ]),
  updateProduct
);

router.put('/:id/stock', protect, updateStock);
router.delete('/:id', protect, deleteProduct);

module.exports = router;