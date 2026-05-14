const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  },
  subject: {
    type: String,
    required: [true, 'Please provide a subject'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Please provide your message'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  category: {
    type: String,
    enum: ['general', 'product', 'order', 'support', 'feedback', 'complaint'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied', 'archived', 'spam'],
    default: 'unread'
  },
  isStarred: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  adminNotes: {
    type: String,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
  },
  repliedAt: {
    type: Date
  },
  replyMessage: {
    type: String
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  readAt: {
    type: Date
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
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

// Update updatedAt on save
contactSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Method to mark as read
contactSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = Date.now();
  return this.save();
};

// Method to mark as replied
contactSchema.methods.markAsReplied = function(replyMessage, adminId) {
  this.status = 'replied';
  this.repliedAt = Date.now();
  this.replyMessage = replyMessage;
  this.repliedBy = adminId;
  return this.save();
};

// Method to toggle star
contactSchema.methods.toggleStar = function() {
  this.isStarred = !this.isStarred;
  return this.save();
};

// Method to archive
contactSchema.methods.archive = function() {
  this.isArchived = true;
  this.status = 'archived';
  return this.save();
};

module.exports = mongoose.model('Contact', contactSchema);