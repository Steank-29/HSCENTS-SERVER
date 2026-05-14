const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const {
  createOffer,
  getOffers,
  getOffer,
  updateOffer,
  deleteOffer,
  toggleOfferStatus,
  getActiveOffers
} = require('../controllers/offerController');

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Public routes
router.get('/active', getActiveOffers);
router.get('/:id', getOffer);

// Admin routes
router.use(protect);
router.get('/', getOffers);
router.post(
  '/',
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'moreImages', maxCount: 10 }
  ]),
  createOffer
);
router.put(
  '/:id',
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'moreImages', maxCount: 10 }
  ]),
  updateOffer
);
router.delete('/:id', deleteOffer);
router.put('/:id/toggle', toggleOfferStatus);

module.exports = router;