const Order = require('../models/Order');
const nodemailer = require('nodemailer');

const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  }
};

// Email transporter setup
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'hello@hamdiscents.com',
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email function with retry
const sendEmail = async ({ to, subject, html, from = '"Hamdi Scents" <hello@hamdiscents.com>' }) => {
  const transporter = createTransporter();
  const maxRetries = 3;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await transporter.sendMail({ from, to, subject, html });
      logger.info(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      logger.error(`Email attempt ${i + 1} failed for ${to}`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
};

// Professional HTML Templates for Hamdi Scents
const getCustomerOrderEmailHTML = (order, customer, totalAmount) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Order Confirmation - Hamdi Scents</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f6f2; }
      .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #1a2a3a 0%, #2c3e50 100%); padding: 32px 24px; text-align: center; }
      .logo { font-size: 32px; font-weight: bold; color: #F6D673; letter-spacing: 2px; margin-bottom: 8px; }
      .logo span { color: #ffffff; font-weight: normal; }
      .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 500; }
      .content { padding: 40px 32px; }
      .greeting { font-size: 18px; color: #1a2a3a; margin-bottom: 24px; }
      .order-card { background: #f8f4f0; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #F6D673; }
      .order-number { font-size: 20px; font-weight: bold; color: #2c3e50; margin-bottom: 8px; }
      .order-date { color: #7f8c8d; font-size: 14px; margin-bottom: 16px; }
      .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      .items-table th { text-align: left; padding: 12px 0; color: #7f8c8d; font-weight: 500; border-bottom: 1px solid #e0d6cc; }
      .items-table td { padding: 12px 0; border-bottom: 1px solid #f0e8e0; }
      .total-row { font-size: 18px; font-weight: bold; color: #2c3e50; margin-top: 16px; padding-top: 16px; border-top: 2px solid #e0d6cc; }
      .total-amount { font-size: 24px; color: #F6D673; }
      .status-badge { display: inline-block; background: #27ae60; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
      .info-box { background: #e8f5e9; padding: 16px; border-radius: 8px; margin: 24px 0; }
      .footer { background: #f8f4f0; padding: 24px; text-align: center; font-size: 13px; color: #7f8c8d; }
      .social-links { margin-top: 16px; }
      .social-links a { color: #2c3e50; text-decoration: none; margin: 0 8px; }
      @media (max-width: 600px) { .content { padding: 24px; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">HAMDI<span>SCENTS</span></div>
        <h1>✨ Order Confirmed!</h1>
      </div>
      <div class="content">
        <div class="greeting">
          Dear <strong>${customer.fullName}</strong>,
        </div>
        <p>Thank you for choosing <strong>Hamdi Scents</strong>. Your order has been received and is being carefully prepared.</p>
        
        <div class="order-card">
          <div class="order-number">Order #${order.orderNumber}</div>
          <div class="order-date">Placed on: ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          
          <table class="items-table">
            <thead>
              <tr><th>Product</th><th>Qty</th><th>Price</th></tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td><strong>${item.name}</strong>${item.size ? ` (${item.size})` : ''}</td>
                  <td>${item.quantity}</td>
                  <td>${item.price} TND</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total-row">
            <strong>Total Amount:</strong> 
            <span class="total-amount">${totalAmount} TND</span>
          </div>
          <div style="margin-top: 16px;">
            <span class="status-badge">💰 Payment: Cash on Delivery</span>
          </div>
        </div>
        
        <div class="info-box">
          <strong>📦 What's next?</strong><br>
          • We'll prepare your order within 24 hours<br>
          • You'll receive a confirmation call before delivery<br>
          • Delivery typically takes 2-3 business days<br>
          • Cash on delivery — pay when you receive your order
        </div>
        
        <p>Need assistance? Contact us at <strong>support@hamdiscents.com</strong></p>
        
        <p style="margin-top: 32px;">With love,<br><strong>The Hamdi Scents Team</strong></p>
      </div>
      <div class="footer">
        <p>© 2024 Hamdi Scents — Premium Fragrances</p>
        <div class="social-links">
          <a href="#">Instagram</a> • <a href="#">Facebook</a> • <a href="#">TikTok</a>
        </div>
        <p style="font-size: 11px; margin-top: 16px;">This email was sent to ${customer.email}</p>
      </div>
    </div>
  </body>
  </html>
`;

const getAdminOrderEmailHTML = (order, customer, totalAmount) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>New Order Alert - Hamdi Scents Admin</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f0f2f5; }
      .container { max-width: 700px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%); padding: 24px; text-align: center; color: white; }
      .header h1 { margin: 0; font-size: 28px; }
      .header p { margin: 8px 0 0; opacity: 0.9; }
      .content { padding: 32px; }
      .alert-box { background: #fff3e0; border-left: 4px solid #e74c3c; padding: 16px; margin: 20px 0; border-radius: 8px; }
      .order-info { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
      .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
      .info-label { font-weight: 600; color: #495057; }
      .info-value { color: #212529; }
      .items-list { background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin: 16px 0; }
      .item { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
      .item:last-child { border-bottom: none; }
      .total { font-size: 20px; font-weight: bold; color: #2c3e50; margin-top: 16px; text-align: right; padding-top: 12px; border-top: 2px solid #e0d6cc; }
      .action-buttons { margin: 24px 0; text-align: center; }
      .btn { display: inline-block; padding: 12px 24px; margin: 0 8px; border-radius: 6px; text-decoration: none; font-weight: 600; }
      .btn-primary { background: #2c3e50; color: white; }
      .btn-secondary { background: #e9ecef; color: #495057; }
      .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🛍️ NEW ORDER RECEIVED!</h1>
        <p>Action Required — Process this order</p>
      </div>
      <div class="content">
        <div class="alert-box">
          <strong>⚠️ New order requires attention</strong><br>
          Order placed on ${new Date(order.createdAt).toLocaleString()}
        </div>
        
        <div class="order-info">
          <div class="info-row">
            <span class="info-label">Order Number:</span>
            <span class="info-value"><strong>${order.orderNumber}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer Name:</span>
            <span class="info-value">${customer.fullName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${customer.email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${customer.phone || 'Not provided'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Method:</span>
            <span class="info-value">Cash on Delivery</span>
          </div>
          ${customer.address ? `
          <div class="info-row">
            <span class="info-label">Delivery Address:</span>
            <span class="info-value">${customer.address}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="items-list">
          <h4 style="margin: 0 0 12px;">📋 Order Items:</h4>
          ${order.items.map(item => `
            <div class="item">
              <strong>${item.name}</strong> ${item.size ? `(${item.size})` : ''} — ${item.quantity} × ${item.price} TND = <strong>${item.price * item.quantity} TND</strong>
            </div>
          `).join('')}
          <div class="total">
            TOTAL: ${totalAmount} TND
          </div>
        </div>
        
        <div class="action-buttons">
          <a href="${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/orders/${order._id}" class="btn btn-primary">📦 View & Process Order</a>
          <a href="${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/orders" class="btn btn-secondary">📋 View All Orders</a>
        </div>
        
        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-top: 20px;">
          <strong>✅ Admin Checklist:</strong><br>
          □ Verify stock availability<br>
          □ Contact customer to confirm delivery<br>
          □ Prepare order for shipment<br>
          □ Update order status in dashboard
        </div>
      </div>
      <div class="footer">
        <p>Hamdi Scents Admin System — Automated Notification</p>
      </div>
    </div>
  </body>
  </html>
`;

const getStatusUpdateEmailHTML = (order, status, customer) => {
  const statusMessages = {
    processing: 'Your order is now being prepared',
    shipped: 'Your order has been shipped!',
    delivered: 'Your order has been delivered',
    cancelled: 'Order status update'
  };
  
  const statusColors = {
    processing: '#3498db',
    shipped: '#f39c12',
    delivered: '#27ae60',
    cancelled: '#e74c3c'
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Order Update - Hamdi Scents</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 550px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1a2a3a 0%, #2c3e50 100%); padding: 24px; text-align: center; color: white; }
        .logo { font-size: 24px; font-weight: bold; color: #F6D673; margin-bottom: 8px; }
        .content { padding: 32px; }
        .status-card { text-align: center; padding: 24px; background: #f8f4f0; border-radius: 12px; margin: 20px 0; }
        .status-icon { font-size: 48px; margin-bottom: 16px; }
        .status-text { font-size: 20px; font-weight: bold; color: ${statusColors[status] || '#2c3e50'}; margin: 12px 0; }
        .order-number { color: #7f8c8d; font-size: 14px; margin-top: 8px; }
        .btn { display: inline-block; padding: 12px 24px; background: #2c3e50; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { background: #f8f4f0; padding: 20px; text-align: center; font-size: 12px; color: #7f8c8d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">HAMDI SCENTS</div>
          <h3>Order Update</h3>
        </div>
        <div class="content">
          <p>Dear <strong>${customer.fullName}</strong>,</p>
          <div class="status-card">
            <div class="status-icon">
              ${status === 'shipped' ? '🚚' : status === 'delivered' ? '✅' : status === 'processing' ? '⚙️' : '📋'}
            </div>
            <div class="status-text">${statusMessages[status] || 'Your order status has been updated'}</div>
            <div>Current Status: <strong style="color: ${statusColors[status]};">${status.toUpperCase()}</strong></div>
            <div class="order-number">Order #${order.orderNumber}</div>
          </div>
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/track-order/${order.orderNumber}" class="btn">Track Your Order</a>
          </div>
          <p style="margin-top: 24px;">Thank you for shopping with Hamdi Scents!</p>
        </div>
        <div class="footer">
          <p>© 2024 Hamdi Scents — Premium Fragrances</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Public
exports.createOrder = async (req, res) => {
  try {
    const { items, customer, paymentMethod, notes } = req.body;

    logger.info('Creating new order', { customer: customer.email });

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in order'
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = subtotal;

    // Create order
    const order = await Order.create({
      items,
      customer,
      subtotal,
      totalAmount,
      paymentMethod: paymentMethod || 'cash_on_delivery',
      notes: notes || '',
      orderStatus: 'pending',
      paymentStatus: 'pending'
    });

    logger.info('Order created successfully', { orderId: order._id, orderNumber: order.orderNumber });

    // Send confirmation email to customer
    const customerEmailHTML = getCustomerOrderEmailHTML(order, customer, totalAmount);
    
    await sendEmail({
      to: customer.email,
      subject: `Order Confirmed #${order.orderNumber}`,
      html: customerEmailHTML
    }).catch(emailError => {
      logger.error('Failed to send customer email', emailError);
    });

    // Send notification to admin
    const adminEmailHTML = getAdminOrderEmailHTML(order, customer, totalAmount);
    
    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@hamdiscents.com',
      subject: `New Order Alert #${order.orderNumber}`,
      html: adminEmailHTML
    }).catch(emailError => {
      logger.error('Failed to send admin email', emailError);
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus
      }
    });
  } catch (error) {
    logger.error('Create order error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res) => {
  try {
    const { status, search, sort = '-createdAt', page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.orderStatus = status;
    
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.fullName': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const orders = await Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Order.countDocuments(query);

    const stats = {
      total: await Order.countDocuments(),
      pending: await Order.countDocuments({ orderStatus: 'pending' }),
      processing: await Order.countDocuments({ orderStatus: 'processing' }),
      shipped: await Order.countDocuments({ orderStatus: 'shipped' }),
      delivered: await Order.countDocuments({ orderStatus: 'delivered' }),
      cancelled: await Order.countDocuments({ orderStatus: 'cancelled' }),
      totalRevenue: (await Order.aggregate([
        { $match: { orderStatus: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]))[0]?.total || 0
    };

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      stats,
      orders
    });
  } catch (error) {
    logger.error('Get orders error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private/Admin
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    logger.error('Get order error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order'
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = status;
    await order.save();

    logger.info('Order status updated', { orderId: order._id, oldStatus, newStatus: status });

    // Send status update email to customer (only for specific status changes)
    const notifyStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    if (status !== oldStatus && notifyStatuses.includes(status)) {
      const statusEmailHTML = getStatusUpdateEmailHTML(order, status, order.customer);
      await sendEmail({
        to: order.customer.email,
        subject: `Order ${status === 'shipped' ? 'Shipped' : 'Update'} #${order.orderNumber}`,
        html: statusEmailHTML
      }).catch(emailError => {
        logger.error('Failed to send status update email', emailError);
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    logger.error('Update order status error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating order status'
    });
  }
};