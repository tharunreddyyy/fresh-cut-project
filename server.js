require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/freshcut';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected to Atlas'))
  .catch(err => console.log('❌ MongoDB error:', err));

// ============= MODELS =============

// User Model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phone: String,
  address: String,
  role: { type: String, enum: ['customer', 'vendor', 'admin'], default: 'customer' },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', UserSchema);

// Vendor Model
const VendorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  storeName: { type: String, required: true },
  storeDescription: String,
  address: String,
  city: String,
  pincode: String,
  phone: String,
  email: String,
  logo: String,
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'verified' },
  isVerified: { type: Boolean, default: true },
  hygieneScore: { type: Number, default: 95 },
  rating: { type: Number, default: 4.5 },
  totalReviews: { type: Number, default: 0 },
  openingTime: String,
  closingTime: String,
  isOpen: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Vendor = mongoose.model('Vendor', VendorSchema);

// Product Model
const ProductSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['chicken', 'mutton', 'fish', 'pork', 'beef', 'prawns', 'eggs'], required: true },
  price: { type: Number, required: true },
  unit: { type: String, default: 'kg' },
  availableCuts: [{ type: String }],
  availableQuantity: { type: Number, default: 0 },
  image: { type: String, default: '' },
  cutTime: { type: Date, default: Date.now },
  storageCondition: { type: String, default: 'refrigerated' },
  freshnessScore: { type: Number, default: 100 },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

ProductSchema.methods.updateFreshnessScore = function() {
  if (this.cutTime) {
    const hoursSinceCut = (Date.now() - new Date(this.cutTime)) / (1000 * 60 * 60);
    this.freshnessScore = Math.max(0, Math.min(100, Math.floor(100 - (hoursSinceCut * 2))));
  }
  return this.freshnessScore;
};

const Product = mongoose.model('Product', ProductSchema);

// Order Model
const OrderSchema = new mongoose.Schema({
  orderId: String,
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'], default: 'pending' },
  paymentMethod: { type: String, enum: ['online', 'cod'], default: 'cod' },
  paymentStatus: { type: String, default: 'pending' },
  deliveryAddress: String,
  deliveryInstructions: String,
  orderTimeline: [{
    status: String,
    timestamp: Date,
    description: String
  }],
  createdAt: { type: Date, default: Date.now }
});

OrderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = 'FC' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

const Order = mongoose.model('Order', OrderSchema);

// ============= MIDDLEWARE =============
const JWT_SECRET = process.env.JWT_SECRET || 'secretkey_change_in_production';
const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// ============= AUTH ROUTES =============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, address, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    
    const user = new User({ name, email, password, phone, address, role });
    await user.save();
    
    if (role === 'vendor') {
      const vendor = new Vendor({ 
        userId: user._id, 
        storeName: name, 
        email, 
        phone, 
        address 
      });
      await vendor.save();
    }
    
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email, role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    
    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });
    
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password');
  res.json(user);
});

// ============= VENDOR ROUTES =============
app.get('/api/vendors', async (req, res) => {
  try {
    const vendors = await Vendor.find({ verificationStatus: 'verified' });
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/vendors/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/vendors/:id/products', async (req, res) => {
  try {
    let products = await Product.find({ vendorId: req.params.id, isAvailable: true }).populate('vendorId');
    products = products.map(p => {
      p.updateFreshnessScore();
      return p;
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/vendors/:id', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============= PRODUCT ROUTES =============
app.get('/api/products', async (req, res) => {
  try {
    let products = await Product.find({ isAvailable: true }).populate('vendorId');
    products = products.map(p => {
      p.updateFreshnessScore();
      return p;
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/products', auth, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') return res.status(403).json({ message: 'Vendor only' });
    
    const vendor = await Vendor.findOne({ userId: req.user.userId });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    
    const product = new Product({
      ...req.body,
      vendorId: vendor._id,
      cutTime: new Date(),
      freshnessScore: 100
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/products/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isAvailable: false });
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============= ORDER ROUTES =============
app.post('/api/orders', auth, async (req, res) => {
  try {
    const { items, vendorId, totalAmount, paymentMethod, deliveryAddress, deliveryInstructions } = req.body;
    
    const order = new Order({
      customerId: req.user.userId,
      vendorId,
      items,
      totalAmount,
      paymentMethod,
      deliveryAddress,
      deliveryInstructions,
      orderTimeline: [{ status: 'pending', timestamp: new Date(), description: 'Order placed' }]
    });
    
    await order.save();
    
    // Update product quantities
    for (let item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { availableQuantity: -item.quantity } });
    }
    
    io.to(`vendor-${vendorId}`).emit('new-order', order);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/orders/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user.userId }).populate('vendorId').sort('-createdAt');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/orders/vendor-orders', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.user.userId });
    if (!vendor) return res.json([]);
    const orders = await Order.find({ vendorId: vendor._id }).populate('customerId').sort('-createdAt');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/orders/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    
    order.status = status;
    order.orderTimeline.push({
      status,
      timestamp: new Date(),
      description: `Order ${status}`
    });
    
    await order.save();
    io.to(`order-${order._id}`).emit('order-update', { orderId: order._id, status });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/orders/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('vendorId');
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============= Socket.io =============
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('track-order', (orderId) => socket.join(`order-${orderId}`));
  socket.on('vendor-online', (vendorId) => socket.join(`vendor-${vendorId}`));
});

// Serve HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));