const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus
} = require('../controllers/couponController');

// All routes require admin authentication
router.use(protect);

router.post('/', createCoupon);
router.get('/', getCoupons);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.put('/:id/toggle', toggleCouponStatus);

module.exports = router;