require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Models ──────────────────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  role: { type: String, default: 'vendor' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const VendorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shopName: { type: String, required: true },
  shopAddress: {
    street: String,
    city: String,
    pincode: String,
    coordinates: { lat: Number, lng: Number }
  },
  phone: String,
  email: String,
  verificationStatus: { type: String, default: 'verified' },
  hygieneScore: { type: Number, default: 0 },
  hygieneCompliance: {
    dailyCleaning: Boolean,
    properStorage: Boolean,
    protectiveGear: Boolean,
    temperatureControl: Boolean,
    lastUpdated: Date
  },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  verifiedBadge: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Vendor = mongoose.model('Vendor', VendorSchema);

const ProductSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['chicken', 'mutton', 'fish', 'pork', 'beef'], required: true },
  price: { type: Number, required: true },
  unit: { type: String, default: 'kg' },
  cuts: [{ type: String, enum: ['whole', 'curry', 'boneless', 'fillet', 'minced'] }],
  availability: { type: Number, default: 0 },
  image: String,
  freshness: {
    cutTime: Date,
    packedTime: Date,
    storageCondition: { type: String, default: 'refrigerated' },
    freshnessScore: { type: Number, default: 100 },
    estimatedFreshnessDuration: { type: Number, default: 24 }
  },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', ProductSchema);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const cutTime = new Date(now.getTime() - 1 * 60 * 60 * 1000); // cut 1 hour ago

async function seed() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected!\n');

    // ── 1. Create vendor users ──────────────────────────────────────────────
    const hashedPw = await bcrypt.hash('vendor123', 10);

    const vendorUsersData = [
      { name: 'Ramu Chicken Shop',  email: 'ramu@freshcut.com',  phone: '9876543210' },
      { name: 'Babu Mutton Center', email: 'babu@freshcut.com',  phone: '9876543211' },
      { name: 'Seenu Fish Market',  email: 'seenu@freshcut.com', phone: '9876543212' },
    ];

    const vendorUsers = [];
    for (const u of vendorUsersData) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        vendorUsers.push(existing);
        console.log(`⚠️  User already exists: ${u.email}`);
      } else {
        const user = await User.create({ ...u, password: hashedPw, role: 'vendor' });
        vendorUsers.push(user);
        console.log(`👤 Created user: ${u.name}`);
      }
    }

    // ── 2. Create vendors ───────────────────────────────────────────────────
    const vendorData = [
      {
        shopName: 'Ramu Fresh Chicken',
        shopAddress: { street: '12, Market Road', city: 'Hyderabad', pincode: '500001', coordinates: { lat: 17.3850, lng: 78.4867 } },
        phone: '9876543210', email: 'ramu@freshcut.com',
        hygieneScore: 92, hygieneCompliance: { dailyCleaning: true, properStorage: true, protectiveGear: true, temperatureControl: true, lastUpdated: now },
        rating: 4.5, totalReviews: 128, verifiedBadge: true
      },
      {
        shopName: 'Babu Mutton & More',
        shopAddress: { street: '45, Old City Lane', city: 'Hyderabad', pincode: '500002', coordinates: { lat: 17.3616, lng: 78.4747 } },
        phone: '9876543211', email: 'babu@freshcut.com',
        hygieneScore: 87, hygieneCompliance: { dailyCleaning: true, properStorage: true, protectiveGear: false, temperatureControl: true, lastUpdated: now },
        rating: 4.2, totalReviews: 85, verifiedBadge: true
      },
      {
        shopName: 'Seenu Seafood Hub',
        shopAddress: { street: '7, Fish Market Street', city: 'Hyderabad', pincode: '500003', coordinates: { lat: 17.4399, lng: 78.4983 } },
        phone: '9876543212', email: 'seenu@freshcut.com',
        hygieneScore: 95, hygieneCompliance: { dailyCleaning: true, properStorage: true, protectiveGear: true, temperatureControl: true, lastUpdated: now },
        rating: 4.7, totalReviews: 203, verifiedBadge: true
      }
    ];

    const vendors = [];
    for (let i = 0; i < vendorData.length; i++) {
      const existing = await Vendor.findOne({ email: vendorData[i].email });
      if (existing) {
        vendors.push(existing);
        console.log(`⚠️  Vendor already exists: ${vendorData[i].shopName}`);
      } else {
        const vendor = await Vendor.create({ ...vendorData[i], userId: vendorUsers[i]._id, verificationStatus: 'verified' });
        vendors.push(vendor);
        console.log(`🏪 Created vendor: ${vendorData[i].shopName}`);
      }
    }

    const [ramuVendor, babuVendor, seenuVendor] = vendors;

    // ── 3. Create Products ──────────────────────────────────────────────────
    const products = [
      // ── Ramu Chicken (vendorId: ramuVendor) ──
      {
        vendorId: ramuVendor._id,
        name: 'Farm Fresh Whole Chicken',
        type: 'chicken', price: 199, unit: 'kg',
        cuts: ['whole', 'curry', 'boneless'],
        availability: 25,
        image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 98, estimatedFreshnessDuration: 24 }
      },
      {
        vendorId: ramuVendor._id,
        name: 'Boneless Chicken Breast',
        type: 'chicken', price: 279, unit: 'kg',
        cuts: ['boneless'],
        availability: 15,
        image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 97, estimatedFreshnessDuration: 24 }
      },
      {
        vendorId: ramuVendor._id,
        name: 'Chicken Curry Cut',
        type: 'chicken', price: 219, unit: 'kg',
        cuts: ['curry'],
        availability: 20,
        image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 96, estimatedFreshnessDuration: 24 }
      },
      {
        vendorId: ramuVendor._id,
        name: 'Chicken Minced (Kheema)',
        type: 'chicken', price: 249, unit: 'kg',
        cuts: ['minced'],
        availability: 10,
        image: 'https://images.unsplash.com/photo-1529694157872-4e0c0f3b238b?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 99, estimatedFreshnessDuration: 12 }
      },

      // ── Babu Mutton (vendorId: babuVendor) ──
      {
        vendorId: babuVendor._id,
        name: 'Fresh Goat Mutton',
        type: 'mutton', price: 699, unit: 'kg',
        cuts: ['curry', 'boneless'],
        availability: 12,
        image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 95, estimatedFreshnessDuration: 24 }
      },
      {
        vendorId: babuVendor._id,
        name: 'Boneless Mutton Leg',
        type: 'mutton', price: 849, unit: 'kg',
        cuts: ['boneless'],
        availability: 8,
        image: 'https://images.unsplash.com/photo-1545208700-7e13c673b38e?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 94, estimatedFreshnessDuration: 24 }
      },
      {
        vendorId: babuVendor._id,
        name: 'Mutton Kheema (Minced)',
        type: 'mutton', price: 749, unit: 'kg',
        cuts: ['minced'],
        availability: 10,
        image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 97, estimatedFreshnessDuration: 12 }
      },
      {
        vendorId: babuVendor._id,
        name: 'Pork Belly Slices',
        type: 'pork', price: 449, unit: 'kg',
        cuts: ['curry', 'boneless'],
        availability: 7,
        image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 93, estimatedFreshnessDuration: 24 }
      },

      // ── Seenu Seafood (vendorId: seenuVendor) ──
      {
        vendorId: seenuVendor._id,
        name: 'Fresh Rohu Fish (Whole)',
        type: 'fish', price: 299, unit: 'kg',
        cuts: ['whole', 'fillet'],
        availability: 30,
        image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 99, estimatedFreshnessDuration: 12 }
      },
      {
        vendorId: seenuVendor._id,
        name: 'Pomfret Fish Fillet',
        type: 'fish', price: 549, unit: 'kg',
        cuts: ['fillet', 'whole'],
        availability: 15,
        image: 'https://images.unsplash.com/photo-1510130387422-82bed34b37e9?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 98, estimatedFreshnessDuration: 12 }
      },
      {
        vendorId: seenuVendor._id,
        name: 'Surmai (King Fish) Steaks',
        type: 'fish', price: 649, unit: 'kg',
        cuts: ['fillet'],
        availability: 10,
        image: 'https://images.unsplash.com/photo-1576072754373-3c4b3d08d4e0?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 97, estimatedFreshnessDuration: 12 }
      },
      {
        vendorId: seenuVendor._id,
        name: 'Tiger Prawns (Large)',
        type: 'fish', price: 799, unit: 'kg',
        cuts: ['whole'],
        availability: 8,
        image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 99, estimatedFreshnessDuration: 8 }
      },
      {
        vendorId: seenuVendor._id,
        name: 'Catla Fish Curry Cut',
        type: 'fish', price: 319, unit: 'kg',
        cuts: ['curry', 'fillet'],
        availability: 20,
        image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 96, estimatedFreshnessDuration: 12 }
      },
      {
        vendorId: seenuVendor._id,
        name: 'Beef Curry Cut',
        type: 'beef', price: 549, unit: 'kg',
        cuts: ['curry', 'boneless'],
        availability: 12,
        image: 'https://images.unsplash.com/photo-1558030006-450675393462?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 95, estimatedFreshnessDuration: 24 }
      },
      {
        vendorId: ramuVendor._id,
        name: 'Chicken Wings (Party Pack)',
        type: 'chicken', price: 259, unit: 'kg',
        cuts: ['whole'],
        availability: 18,
        image: 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400',
        freshness: { cutTime, packedTime: cutTime, storageCondition: 'refrigerated', freshnessScore: 98, estimatedFreshnessDuration: 24 }
      },
    ];

    console.log('\n🥩 Inserting products...');
    let count = 0;
    for (const p of products) {
      await Product.create(p);
      console.log(`  ✅ ${p.name} — ₹${p.price}/${p.unit}`);
      count++;
    }

    console.log(`\n🎉 Done! Inserted ${count} products across 3 vendors.`);
    console.log('📦 Check your Atlas dashboard → freshcut → products collection\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
