const Contact = require('../models/Contact');
const sendEmail = require('../utils/sendEmail');

// Logger utility
const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  }
};

// @desc    Submit contact form
// @route   POST /api/contact
// @access  Public
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    logger.info('New contact form submission', { name, email, subject });

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Get IP and user agent
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Create contact message
    const contact = await Contact.create({
      name,
      email,
      subject,
      message,
      ipAddress,
      userAgent,
      status: 'unread'
    });

    logger.info('Contact message saved', { contactId: contact._id, email });

    // Send auto-reply to customer
    const autoReplyHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You for Contacting Us</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0a1928 0%, #1e3a5f 100%); padding: 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background-color: #1e3a5f; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .message-box { background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ ${process.env.APP_NAME || 'Hamdi Scents'}</h1>
          </div>
          <div class="content">
            <h2 style="color: #1e3a5f;">Thank You for Contacting Us, ${name}!</h2>
            <p>We have received your message and our team will get back to you within 24-48 hours.</p>
            <div class="message-box">
              <p><strong>Your Message:</strong></p>
              <p style="color: #666;">${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
            </div>
            <p>In the meantime, you can:</p>
            <ul>
              <li>Check our <a href="${process.env.CLIENT_URL}/fragrances" style="color: #1e3a5f;">Fragrance Collection</a></li>
              <li>Follow us on social media for updates and offers</li>
              <li>Visit our FAQ page for quick answers</li>
            </ul>
            <p>Best regards,<br><strong>The ${process.env.APP_NAME || 'Hamdi Scents'} Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Hamdi Scents'}. All rights reserved.</p>
            <p>This is an automated response, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      email: contact.email,
      subject: `Thank You for Contacting ${process.env.APP_NAME || 'Hamdi Scents'}`,
      html: autoReplyHTML
    }).catch(emailError => {
      logger.error('Failed to send auto-reply email', emailError);
      // Don't fail the request if email fails
    });

    // Send notification to admin
    const adminNotificationHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>New Contact Message</title>
        <style>
          body { font-family: 'Arial', sans-serif; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
          .header { background: #1e3a5f; color: white; padding: 10px 20px; border-radius: 10px 10px 0 0; }
          .content { padding: 20px; }
          .info { margin: 10px 0; }
          .label { font-weight: bold; color: #1e3a5f; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Contact Form Submission</h2>
          </div>
          <div class="content">
            <div class="info"><span class="label">From:</span> ${name} (${email})</div>
            <div class="info"><span class="label">Subject:</span> ${subject}</div>
            <div class="info"><span class="label">Message:</span></div>
            <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin-top: 5px;">${message}</div>
            <div class="info"><span class="label">IP Address:</span> ${ipAddress}</div>
            <div class="info"><span class="label">Time:</span> ${new Date().toLocaleString()}</div>
            <p style="margin-top: 20px;">
              <a href="${process.env.CLIENT_URL}/admin/messages" style="background: #1e3a5f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Admin Panel</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      email: process.env.EMAIL_ADMIN || 'admin@hamdiscents.com',
      subject: `New Contact Message from ${name}`,
      html: adminNotificationHTML
    }).catch(emailError => {
      logger.error('Failed to send admin notification', emailError);
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully! We will get back to you soon.',
      data: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        createdAt: contact.createdAt
      }
    });
  } catch (error) {
    logger.error('Contact form submission error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all contact messages (Admin)
// @route   GET /api/contact
// @access  Private/Admin
exports.getMessages = async (req, res) => {
  try {
    const {
      status,
      category,
      isStarred,
      isArchived,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 20
    } = req.query;

    logger.info('Fetching contact messages', { requestedBy: req.user.id });

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (isStarred === 'true') query.isStarred = true;
    if (isArchived === 'true') query.isArchived = true;
    else if (isArchived === 'false') query.isArchived = false;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const messages = await Contact.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('repliedBy', 'name email');

    const total = await Contact.countDocuments(query);

    // Get statistics
    const stats = {
      total: await Contact.countDocuments(),
      unread: await Contact.countDocuments({ status: 'unread' }),
      read: await Contact.countDocuments({ status: 'read' }),
      replied: await Contact.countDocuments({ status: 'replied' }),
      archived: await Contact.countDocuments({ isArchived: true }),
      starred: await Contact.countDocuments({ isStarred: true }),
      spam: await Contact.countDocuments({ status: 'spam' })
    };

    logger.info(`Retrieved ${messages.length} messages`);

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      stats,
      messages
    });
  } catch (error) {
    logger.error('Get messages error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single message (Admin)
// @route   GET /api/contact/:id
// @access  Private/Admin
exports.getMessage = async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id).populate('repliedBy', 'name email');
    
    if (!message) {
      logger.warn('Message not found', { messageId: req.params.id });
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Mark as read if unread
    if (message.status === 'unread') {
      await message.markAsRead();
      logger.info('Message marked as read', { messageId: message._id });
    }

    res.status(200).json({
      success: true,
      message
    });
  } catch (error) {
    logger.error('Get message error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Reply to message (Admin)
// @route   POST /api/contact/:id/reply
// @access  Private/Admin
exports.replyToMessage = async (req, res) => {
  try {
    const { replyMessage } = req.body;
    const message = await Contact.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (!replyMessage || replyMessage.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reply message'
      });
    }

    // Send reply email to customer
    const replyEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reply from ${process.env.APP_NAME || 'Hamdi Scents'}</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0a1928 0%, #1e3a5f 100%); padding: 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .reply-box { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F6D673; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 ${process.env.APP_NAME || 'Hamdi Scents'}</h1>
          </div>
          <div class="content">
            <h2 style="color: #1e3a5f;">Hello ${message.name},</h2>
            <p>Thank you for reaching out to us. Here's our response to your inquiry:</p>
            <div class="reply-box">
              <p style="margin: 0; line-height: 1.6;">${replyMessage.replace(/\n/g, '<br>')}</p>
            </div>
            <p>If you have any further questions, please don't hesitate to contact us again.</p>
            <p>Best regards,<br><strong>The ${process.env.APP_NAME || 'Hamdi Scents'} Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Hamdi Scents'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      email: message.email,
      subject: `Re: ${message.subject}`,
      html: replyEmailHTML
    });

    // Update message status
    await message.markAsReplied(replyMessage, req.user.id);

    logger.info('Reply sent successfully', { 
      messageId: message._id, 
      to: message.email,
      repliedBy: req.user.id 
    });

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully',
      data: {
        repliedAt: message.repliedAt,
        replyMessage: message.replyMessage
      }
    });
  } catch (error) {
    logger.error('Reply to message error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending reply',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Mark message as read (Admin)
// @route   PUT /api/contact/:id/read
// @access  Private/Admin
exports.markAsRead = async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
      data: { readAt: message.readAt }
    });
  } catch (error) {
    logger.error('Mark as read error', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Toggle star on message (Admin)
// @route   PUT /api/contact/:id/star
// @access  Private/Admin
exports.toggleStar = async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.toggleStar();

    res.status(200).json({
      success: true,
      message: message.isStarred ? 'Message starred' : 'Message unstarred',
      isStarred: message.isStarred
    });
  } catch (error) {
    logger.error('Toggle star error', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Archive message (Admin)
// @route   PUT /api/contact/:id/archive
// @access  Private/Admin
exports.archiveMessage = async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.archive();

    res.status(200).json({
      success: true,
      message: 'Message archived',
      isArchived: message.isArchived
    });
  } catch (error) {
    logger.error('Archive message error', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete message (Admin)
// @route   DELETE /api/contact/:id
// @access  Private/Admin
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Contact.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.deleteOne();

    logger.info('Message deleted', { messageId: req.params.id, deletedBy: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Delete message error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Bulk delete messages (Admin)
// @route   DELETE /api/contact/bulk/delete
// @access  Private/Admin
exports.bulkDeleteMessages = async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    if (!messageIds || !messageIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Please provide message IDs to delete'
      });
    }

    const result = await Contact.deleteMany({ _id: { $in: messageIds } });

    logger.info('Bulk delete messages', { 
      count: result.deletedCount, 
      deletedBy: req.user.id 
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} messages deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Bulk delete error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Bulk mark as read (Admin)
// @route   PUT /api/contact/bulk/read
// @access  Private/Admin
exports.bulkMarkAsRead = async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    if (!messageIds || !messageIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Please provide message IDs'
      });
    }

    const result = await Contact.updateMany(
      { _id: { $in: messageIds }, status: 'unread' },
      { status: 'read', readAt: Date.now() }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} messages marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    logger.error('Bulk mark as read error', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get contact statistics (Admin)
// @route   GET /api/contact/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
  try {
    const stats = {
      total: await Contact.countDocuments(),
      unread: await Contact.countDocuments({ status: 'unread' }),
      read: await Contact.countDocuments({ status: 'read' }),
      replied: await Contact.countDocuments({ status: 'replied' }),
      archived: await Contact.countDocuments({ isArchived: true }),
      starred: await Contact.countDocuments({ isStarred: true }),
      spam: await Contact.countDocuments({ status: 'spam' }),
      lastWeek: await Contact.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    };

    // Get messages by category
    const categoryStats = await Contact.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      stats,
      byCategory: categoryStats
    });
  } catch (error) {
    logger.error('Get stats error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};