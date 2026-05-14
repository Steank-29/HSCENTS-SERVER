const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  submitContactForm,
  getMessages,
  getMessage,
  replyToMessage,
  markAsRead,
  toggleStar,
  archiveMessage,
  deleteMessage,
  bulkDeleteMessages,
  bulkMarkAsRead,
  getStats
} = require('../controllers/contactController');

// Public routes
router.post('/', submitContactForm);

// Admin routes (all require authentication)
router.use(protect); // All routes below this require authentication

// Stats
router.get('/stats', getStats);

// Bulk operations
router.delete('/bulk/delete', bulkDeleteMessages);
router.put('/bulk/read', bulkMarkAsRead);

// Individual message operations
router.get('/', getMessages);
router.get('/:id', getMessage);
router.post('/:id/reply', replyToMessage);
router.put('/:id/read', markAsRead);
router.put('/:id/star', toggleStar);
router.put('/:id/archive', archiveMessage);
router.delete('/:id', deleteMessage);

module.exports = router;