const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const auth = require('../middleware/auth');

// Get all available products
router.get('/', async (req, res) => {
  try {
    const { type, vendorId, nearby } = req.query;
    let query = { isAvailable: true };
    
    if (type) query.type = type;
    if (vendorId) query.vendorId = vendorId;
    
    let products = await Product.find(query).populate('vendorId');
    
    // Update freshness scores
    products = products.map(product => {
      if (product.freshness.cutTime) {
        const hoursSinceCut = (Date.now() - new Date(product.freshness.cutTime)) / (1000 * 60 * 60);
        product.freshness.freshnessScore = Math.max(0, Math.min(100, 100 - (hoursSinceCut * 2)));
      }
      return product;
    });
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('vendorId');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add product (vendor only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const vendor = await Vendor.findOne({ userId: req.user.userId });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    const product = new Product({
      ...req.body,
      vendorId: vendor._id,
      freshness: {
        ...req.body.freshness,
        cutTime: new Date(),
        packedTime: new Date()
      }
    });
    
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update product availability
router.put('/:id/availability', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    product.availability = req.body.availability;
    product.isAvailable = req.body.availability > 0;
    await product.save();
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;