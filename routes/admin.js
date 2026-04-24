const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Verify vendor (admin only)
router.put('/verify-vendor/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        
        vendor.verificationStatus = req.body.status;
        if (req.body.status === 'verified') {
            vendor.verifiedBadge = true;
        }
        
        await vendor.save();
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get pending vendors
router.get('/pending-vendors', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        const vendors = await Vendor.find({ verificationStatus: 'pending' })
            .populate('userId');
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;