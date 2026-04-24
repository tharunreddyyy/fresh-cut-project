const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['chicken', 'mutton', 'fish', 'pork', 'beef'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    default: 'kg'
  },
  cuts: [{
    type: String,
    enum: ['whole', 'curry', 'boneless', 'fillet', 'minced']
  }],
  availability: {
    type: Number,
    default: 0
  },
  image: String,
  freshness: {
    cutTime: Date,
    packedTime: Date,
    storageCondition: {
      type: String,
      enum: ['refrigerated', 'frozen', 'ambient'],
      default: 'refrigerated'
    },
    freshnessScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    estimatedFreshnessDuration: {
      type: Number, // in hours
      default: 24
    }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate freshness score before saving
productSchema.pre('save', function(next) {
  if (this.freshness.cutTime) {
    const hoursSinceCut = (Date.now() - this.freshness.cutTime) / (1000 * 60 * 60);
    this.freshness.freshnessScore = Math.max(0, 100 - (hoursSinceCut * 2));
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);