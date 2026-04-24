const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shopName: {
    type: String,
    required: true
  },
  shopAddress: {
    street: String,
    city: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  phone: String,
  email: String,
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  hygieneCompliance: {
    dailyCleaning: { type: Boolean, default: false },
    properStorage: { type: Boolean, default: false },
    protectiveGear: { type: Boolean, default: false },
    temperatureControl: { type: Boolean, default: false },
    lastUpdated: Date
  },
  hygieneScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  certifications: [String],
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  verifiedBadge: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Vendor', vendorSchema);