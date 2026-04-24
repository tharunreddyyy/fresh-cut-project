const express = require('express');
const router = express.Router();
const Vendor = require('../models/Vendor');
const auth = require('../middleware/auth');

// Get all verified vendors
router.get('/', async (req, res) => {
    try {
        const vendors = await Vendor.find({ verificationStatus: 'verified', isActive: true })
            .populate('userId');
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get vendor by ID
router.get('/:id', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id).populate('userId');
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update hygiene compliance (vendor only)
router.put('/:id/hygiene', auth, async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }
        
        vendor.hygieneCompliance = {
            ...vendor.hygieneCompliance,
            ...req.body,
            lastUpdated: new Date()
        };
        
        // Calculate hygiene score
        const complianceValues = Object.values(vendor.hygieneCompliance).filter(v => typeof v === 'boolean');
        const trueCount = complianceValues.filter(v => v === true).length;
        vendor.hygieneScore = (trueCount / complianceValues.length) * 100;
        
        await vendor.save();
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;