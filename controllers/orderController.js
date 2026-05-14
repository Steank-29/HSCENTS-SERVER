const Order = require('../models/Order');
const sendEmail = require('../utils/sendEmail');

const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? data : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? error : '');
  }
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
    const totalAmount = subtotal; // No discount for now

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
    const customerEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Order Confirmation</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0a1928 0%, #1e3a5f 100%); padding: 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .order-details { background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .total { font-size: 24px; font-weight: bold; color: #F6D673; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Order Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Thank you for your order, ${customer.fullName}!</h2>
            <p>Your order has been received and is being processed.</p>
            <div class="order-details">
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Total Amount:</strong> ${totalAmount} TND</p>
              <p><strong>Payment Method:</strong> Cash on Delivery</p>
            </div>
            <p>We will contact you within 24 hours to confirm delivery details.</p>
            <p>Best regards,<br><strong>Hamdi Scents Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Hamdi Scents. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      email: customer.email,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html: customerEmailHTML
    }).catch(emailError => {
      logger.error('Failed to send customer email', emailError);
    });

    // Send notification to admin
    const adminEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>New Order Received</title>
        <style>
          body { font-family: 'Arial', sans-serif; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
          .header { background: #1e3a5f; color: white; padding: 10px 20px; border-radius: 10px 10px 0 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Order Received!</h2>
          </div>
          <div class="content">
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Customer:</strong> ${customer.fullName} (${customer.email})</p>
            <p><strong>Total:</strong> ${totalAmount} TND</p>
            <p><a href="${process.env.CLIENT_URL}/admin/orders/${order._id}">View Order Details</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      email: process.env.EMAIL_ADMIN || 'admin@hamdiscents.com',
      subject: `New Order - ${order.orderNumber}`,
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

    order.orderStatus = status;
    await order.save();

    logger.info('Order status updated', { orderId: order._id, newStatus: status });

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