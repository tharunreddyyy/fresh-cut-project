const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const auth = require('../middleware/auth');
const { io } = require('../server');

// Place order
router.post('/', auth, async (req, res) => {
  try {
    const { items, vendorId, totalAmount, paymentMethod, deliveryAddress } = req.body;
    
    // Verify freshness guarantee (60 minutes)
    let freshnessGuarantee = { isEligible: false };
    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (product && product.freshness.cutTime) {
        const minutesSinceCut = (Date.now() - new Date(product.freshness.cutTime)) / (1000 * 60);
        if (minutesSinceCut <= 60) {
          freshnessGuarantee.isEligible = true;
          freshnessGuarantee.cutTime = product.freshness.cutTime;
        }
      }
    }
    
    const order = new Order({
      customerId: req.user.userId,
      vendorId,
      items,
      totalAmount,
      paymentMethod,
      deliveryAddress,
      freshnessGuarantee,
      orderTimeline: [{
        status: 'pending',
        timestamp: new Date(),
        description: 'Order placed successfully'
      }]
    });
    
    await order.save();
    
    // Update product availability
    for (let item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { availability: -item.quantity }
      });
    }
    
    // Notify vendor via socket
    io.to(`vendor-${vendorId}`).emit('new-order', { orderId: order._id });
    
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user.userId })
      .populate('vendorId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status (vendor)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    order.status = status;
    order.orderTimeline.push({
      status,
      timestamp: new Date(),
      description: getStatusDescription(status)
    });
    
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      // Check if delivered within 60 minutes for freshness guarantee
      if (order.freshnessGuarantee.isEligible && order.freshnessGuarantee.cutTime) {
        const deliveryMinutes = (order.deliveredAt - new Date(order.freshnessGuarantee.cutTime)) / (1000 * 60);
        order.freshnessGuarantee.deliveredWithin60Mins = deliveryMinutes <= 60;
      }
    }
    
    await order.save();
    
    // Notify customer via socket
    io.to(`order-${order._id}`).emit('order-update', { orderId: order._id, status });
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function getStatusDescription(status) {
  const descriptions = {
    confirmed: 'Order confirmed by vendor',
    preparing: 'Your order is being prepared fresh',
    out_for_delivery: 'Order is out for delivery',
    delivered: 'Order delivered successfully'
  };
  return descriptions[status] || 'Status updated';
}

module.exports = router;