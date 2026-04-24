// Auto-detect API URL: works on localhost AND Render deployment
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin;
const API_URL = `${BASE_URL}/api`;
let currentUser = null;
let cart = [];
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initSocket();
    loadVendors();
    loadProducts();
});

function initSocket() {
    socket = io(BASE_URL);
    socket.on('order-update', (data) => showNotification('Order Update', `Order ${data.orderId} is ${data.status}`));
    socket.on('new-order', () => { if (currentUser?.role === 'vendor') { showNotification('New Order!', 'You have a new order'); loadVendorOrders(); } });
}

async function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const res = await fetch(`${API_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { currentUser = await res.json(); updateNav(); if (currentUser.role === 'vendor') loadVendorDashboard(); }
        } catch(e) { logout(); }
    }
}

function updateNav() {
    const authNav = document.getElementById('auth-nav');
    if (currentUser) {
        authNav.innerHTML = `<div class="dropdown"><button class="btn btn-outline-gold dropdown-toggle" data-bs-toggle="dropdown"><i class="fas fa-user"></i> ${currentUser.name}</button><ul class="dropdown-menu"><li><a class="dropdown-item" onclick="viewMyOrders()"><i class="fas fa-list"></i> My Orders</a></li>${currentUser.role === 'vendor' ? '<li><a class="dropdown-item" onclick="showVendorDashboard()"><i class="fas fa-store"></i> Vendor Dashboard</a></li>' : ''}<li><hr class="dropdown-divider"></li><li><a class="dropdown-item" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</a></li></ul></div><button class="btn btn-outline-light ms-2 position-relative" onclick="showCart()"><i class="fas fa-shopping-cart"></i><span id="cartCount" class="cart-badge">${cart.reduce((s,i)=>s+i.quantity,0)}</span></button>`;
    } else {
        authNav.innerHTML = `<a class="nav-link btn btn-outline-gold ms-2" href="#" data-bs-toggle="modal" data-bs-target="#loginModal"><i class="fas fa-user"></i> Login</a>`;
    }
}

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value }) });
    const data = await res.json();
    if (res.ok) { localStorage.setItem('token', data.token); currentUser = data.user; updateNav(); bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide(); showNotification('Success', 'Logged in!'); loadVendors(); loadProducts(); if (currentUser.role === 'vendor') showVendorDashboard(); }
    else showNotification('Error', data.message, 'error');
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('regName').value, email: document.getElementById('regEmail').value, phone: document.getElementById('regPhone').value, password: document.getElementById('regPassword').value, address: document.getElementById('regAddress').value, role: document.getElementById('regRole').value }) });
    const data = await res.json();
    if (res.ok) { localStorage.setItem('token', data.token); currentUser = data.user; updateNav(); bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide(); showNotification('Success', 'Registered!'); loadVendors(); loadProducts(); if (currentUser.role === 'vendor') showVendorDashboard(); }
    else showNotification('Error', data.message, 'error');
});

async function loadVendors() {
    try {
        const res = await fetch(`${API_URL}/vendors`);
        const vendors = await res.json();
        document.getElementById('vendorCount').innerText = vendors.length;
        const container = document.getElementById('vendorsContainer');
        if (vendors.length === 0) { container.innerHTML = '<div class="col-12 text-center"><p>No vendors yet. Register as a vendor to get started!</p></div>'; return; }
        container.innerHTML = vendors.map(v => `<div class="col-md-6 col-lg-4"><div class="vendor-card" onclick="viewVendorProducts('${v._id}', '${v.storeName}')"><div class="vendor-header"><div class="vendor-logo"><i class="fas fa-store"></i></div>${v.isVerified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}<h4>${v.storeName}</h4><p><i class="fas fa-map-marker-alt"></i> ${v.city || 'Location coming soon'}</p></div><div class="vendor-body"><div class="vendor-rating">${generateStars(v.rating)} (${v.totalReviews} reviews)</div><span class="hygiene-score"><i class="fas fa-spray-can"></i> Hygiene: ${v.hygieneScore}%</span><div class="mt-2"><small><i class="fas fa-clock"></i> ${v.openingTime && v.closingTime ? `${v.openingTime} - ${v.closingTime}` : 'Hours not set'}</small></div></div></div></div>`).join('');
    } catch(e) { console.error(e); }
}

async function loadProducts(vendorId = null) {
    try {
        let url = `${API_URL}/products`;
        if (vendorId) url = `${API_URL}/vendors/${vendorId}/products`;
        const res = await fetch(url);
        let products = await res.json();
        const container = document.getElementById('productsContainer');
        if (!products || products.length === 0) { container.innerHTML = '<div class="col-12 text-center"><p>No products available. Vendors please add products.</p></div>'; return; }
        container.innerHTML = products.map(product => { const freshness = product.freshnessScore || 100; const cutTimeDisplay = getTimeAgo(product.cutTime); const productImage = product.image || 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=300&fit=crop'; const vendorName = product.vendorId?.storeName || 'Local Vendor'; const cuts = product.availableCuts?.join(', ') || 'Curry Cut'; return `<div class="col-md-6 col-lg-4"><div class="product-card"><div class="product-image" style="background-image: url('${productImage}'); background-size: cover; background-position: center;"><span class="freshness-badge"><i class="fas fa-clock"></i> Cut ${cutTimeDisplay}</span><span class="freshness-score"><i class="fas fa-leaf"></i> ${freshness}% Fresh</span><span class="cut-time"><i class="fas fa-cut"></i> ${product.cutTime ? new Date(product.cutTime).toLocaleTimeString() : 'Just now'}</span></div><div class="product-info"><div class="product-vendor"><i class="fas fa-store"></i> ${vendorName}</div><h5 class="product-title">${product.name}</h5><p class="text-muted small">${product.type} • ${cuts}</p><div class="d-flex justify-content-between align-items-center"><span class="product-price">₹${product.price}/${product.unit || 'kg'}</span><div class="quantity-selector"><button onclick="decrementQuantity('${product._id}')">-</button><span id="qty-${product._id}">1</span><button onclick="incrementQuantity('${product._id}')">+</button></div></div><button class="btn btn-primary w-100 mt-3" onclick="addToCart('${product._id}', '${product.name}', ${product.price})"><i class="fas fa-cart-plus"></i> Add to Cart</button></div></div></div>`; }).join('');
    } catch(e) { console.error(e); }
}

function getTimeAgo(date) { if (!date) return 'Just now'; const minutes = Math.floor((Date.now() - new Date(date)) / 60000); if (minutes < 1) return 'Just now'; if (minutes < 60) return `${minutes} min ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`; return `${Math.floor(hours / 24)} days ago`; }
function generateStars(rating) { rating = rating || 0; let stars = ''; for (let i = 1; i <= 5; i++) { if (i <= rating) stars += '<i class="fas fa-star"></i>'; else if (i - 0.5 <= rating) stars += '<i class="fas fa-star-half-alt"></i>'; else stars += '<i class="far fa-star"></i>'; } return stars; }
function incrementQuantity(id) { let span = document.getElementById(`qty-${id}`); let qty = parseInt(span.innerText); qty++; span.innerText = qty; }
function decrementQuantity(id) { let span = document.getElementById(`qty-${id}`); let qty = parseInt(span.innerText); if (qty > 1) { qty--; span.innerText = qty; } }
function addToCart(id, name, price) { const qtySpan = document.getElementById(`qty-${id}`); const quantity = qtySpan ? parseInt(qtySpan.innerText) : 1; const existing = cart.find(i => i.id === id); if (existing) existing.quantity += quantity; else cart.push({ id, name, price, quantity }); updateCartCount(); showNotification('Added!', `${quantity}kg ${name} added`); }
function updateCartCount() { const count = cart.reduce((s, i) => s + i.quantity, 0); const span = document.getElementById('cartCount'); if (span) span.innerText = count; }
function showCart() { const container = document.getElementById('cartItems'); if (cart.length === 0) container.innerHTML = '<p class="text-center">Cart is empty</p>'; else { container.innerHTML = cart.map(item => `<div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded"><div><strong>${item.name}</strong><br>₹${item.price} x ${item.quantity}kg</div><div><button class="btn btn-sm btn-danger" onclick="removeFromCart('${item.id}')">Remove</button></div></div>`).join(''); } document.getElementById('cartTotal').innerText = cart.reduce((s, i) => s + (i.price * i.quantity), 0); new bootstrap.Modal(document.getElementById('cartModal')).show(); }
function removeFromCart(id) { cart = cart.filter(i => i.id !== id); updateCartCount(); showCart(); }

async function placeOrder() {
    if (!currentUser) { showNotification('Login Required', 'Please login first'); return; }
    if (cart.length === 0) { showNotification('Cart Empty', 'Add items first'); return; }
    const vendorsRes = await fetch(`${API_URL}/vendors`);
    const vendors = await vendorsRes.json();
    if (!vendors.length) { showNotification('No Vendors', 'No vendors available', 'error'); return; }
    const orderData = { items: cart.map(i => ({ productId: i.id, name: i.name, quantity: i.quantity, price: i.price })), vendorId: vendors[0]._id, totalAmount: cart.reduce((s, i) => s + (i.price * i.quantity), 0), paymentMethod: 'cod', deliveryAddress: 'Customer Address' };
    const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(orderData) });
    if (res.ok) { cart = []; updateCartCount(); bootstrap.Modal.getInstance(document.getElementById('cartModal')).hide(); showNotification('Order Placed!', 'Your order has been placed'); viewMyOrders(); }
    else { const err = await res.json(); showNotification('Error', err.message, 'error'); }
}

function showVendorDashboard() { loadVendorProducts(); loadVendorOrders(); new bootstrap.Modal(document.getElementById('vendorDashboardModal')).show(); }
async function loadVendorProducts() { const res = await fetch('/api/products'); const products = await res.json(); const container = document.getElementById('vendorProductsList'); if (!products.length) container.innerHTML = '<p>No products yet. Add your first product above.</p>'; else { container.innerHTML = products.map(p => `<div class="d-flex justify-content-between align-items-center p-2 border-bottom"><div><strong>${p.name}</strong><br>₹${p.price}/kg | Stock: ${p.availableQuantity}kg</div><button class="btn btn-sm btn-danger" onclick="deleteProduct('${p._id}')">Delete</button></div>`).join(''); } }
async function loadVendorOrders() { const token = localStorage.getItem('token'); const res = await fetch(`${API_URL}/orders/vendor-orders`, { headers: { 'Authorization': `Bearer ${token}` } }); const orders = await res.json(); const container = document.getElementById('vendorOrdersList'); if (!orders.length) container.innerHTML = '<p>No orders yet</p>'; else { container.innerHTML = orders.map(o => `<div class="border rounded p-2 mb-2"><div><strong>Order #${o.orderId}</strong> - ₹${o.totalAmount}</div><select class="form-select mt-2" onchange="updateOrderStatus('${o._id}', this.value)"><option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option><option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirm</option><option value="preparing" ${o.status === 'preparing' ? 'selected' : ''}>Preparing</option><option value="out_for_delivery" ${o.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option><option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option></select></div>`).join(''); } }
async function updateOrderStatus(orderId, status) { await fetch(`${API_URL}/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ status }) }); showNotification('Updated', 'Order status updated'); loadVendorOrders(); }
async function deleteProduct(productId) { await fetch(`/api/products/${productId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }); showNotification('Deleted', 'Product removed'); loadVendorProducts(); loadProducts(); }

document.getElementById('addProductForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productData = { name: document.getElementById('productName').value, type: document.getElementById('productCategory').value, price: parseFloat(document.getElementById('productPrice').value), availableQuantity: parseFloat(document.getElementById('productQuantity').value), availableCuts: [document.getElementById('productCut').value], image: document.getElementById('productImage').value || '', cutTime: new Date() };
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(productData) });
    if (res.ok) { showNotification('Success', 'Product added'); document.getElementById('addProductForm').reset(); loadVendorProducts(); loadProducts(); }
    else { const err = await res.json(); showNotification('Error', err.message, 'error'); }
});

document.getElementById('vendorStoreForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const vendorsRes = await fetch('/api/vendors');
    const vendors = await vendorsRes.json();
    if (vendors[0]) {
        const updateData = { storeName: document.getElementById('storeName').value, storeDescription: document.getElementById('storeDesc').value, address: document.getElementById('storeAddress').value, city: document.getElementById('storeCity').value, pincode: document.getElementById('storePincode').value, phone: document.getElementById('storePhone').value, openingTime: document.getElementById('openingTime').value, closingTime: document.getElementById('closingTime').value };
        await fetch(`/api/vendors/${vendors[0]._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(updateData) });
        showNotification('Success', 'Store updated!');
        loadVendors();
    }
});

function loadVendorDashboard() {
    fetch('/api/vendors').then(r => r.json()).then(vendors => { if (vendors[0]) { const v = vendors[0]; document.getElementById('storeName').value = v.storeName || ''; document.getElementById('storeDesc').value = v.storeDescription || ''; document.getElementById('storeAddress').value = v.address || ''; document.getElementById('storeCity').value = v.city || ''; document.getElementById('storePincode').value = v.pincode || ''; document.getElementById('storePhone').value = v.phone || ''; document.getElementById('openingTime').value = v.openingTime || '09:00'; document.getElementById('closingTime').value = v.closingTime || '21:00'; } });
    loadVendorProducts(); loadVendorOrders();
}

function viewVendorProducts(vendorId, vendorName) { loadProducts(vendorId); document.getElementById('products').scrollIntoView({ behavior: 'smooth' }); showNotification('Vendor Selected', `Viewing ${vendorName}'s products`); }
async function viewMyOrders() { const res = await fetch(`${API_URL}/orders/my-orders`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }); const orders = await res.json(); const container = document.getElementById('ordersList'); if (!document.getElementById('ordersModal')) { const modal = document.createElement('div'); modal.className = 'modal fade'; modal.id = 'ordersModal'; modal.innerHTML = `<div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header"><h5>My Orders</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body" id="ordersList"></div></div></div>`; document.body.appendChild(modal); } container.innerHTML = orders.map(o => `<div class="card mb-2"><div class="card-body"><div><strong>Order #${o.orderId}</strong> - ₹${o.totalAmount} - ${o.status}</div><p class="small">${new Date(o.createdAt).toLocaleString()}</p><button class="btn btn-sm btn-info" onclick="trackOrder('${o._id}')">Track Order</button></div></div>`).join(''); new bootstrap.Modal(document.getElementById('ordersModal')).show(); }
async function trackOrder(orderId) { const res = await fetch(`${API_URL}/orders/${orderId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }); const order = await res.json(); const steps = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']; const currentIndex = steps.indexOf(order.status); const timelineHtml = steps.map((step, idx) => `<div class="timeline-step ${idx < currentIndex ? 'completed' : idx === currentIndex ? 'active' : ''}"><i class="fas ${step === 'pending' ? 'fa-clock' : step === 'confirmed' ? 'fa-check-circle' : step === 'preparing' ? 'fa-cut' : step === 'out_for_delivery' ? 'fa-truck' : 'fa-home'}"></i><span>${step.replace('_', ' ')}</span></div>`).join(''); const modal = document.createElement('div'); modal.className = 'modal fade'; modal.id = 'trackModal'; modal.innerHTML = `<div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5>Track Order #${order.orderId}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="tracking-timeline">${timelineHtml}</div><div class="alert alert-info mt-3">${order.status}</div></div></div></div>`; document.body.appendChild(modal); new bootstrap.Modal(modal).show(); modal.addEventListener('hidden.bs.modal', () => modal.remove()); }

document.getElementById('searchBtn')?.addEventListener('click', () => { const searchTerm = document.getElementById('searchInput').value.toLowerCase(); const category = document.getElementById('categoryFilter').value; const products = document.querySelectorAll('.product-card'); products.forEach(product => { const card = product.closest('.col-md-6'); const title = product.querySelector('.product-title')?.innerText.toLowerCase(); const vendor = product.querySelector('.product-vendor')?.innerText.toLowerCase(); const matches = (!searchTerm || title?.includes(searchTerm) || vendor?.includes(searchTerm)) && (!category || product.innerText.toLowerCase().includes(category)); card.style.display = matches ? '' : 'none'; }); });

function showNotification(title, message, type = 'success') { const div = document.createElement('div'); div.className = `alert alert-${type === 'error' ? 'danger' : 'success'} position-fixed top-0 end-0 m-3`; div.style.zIndex = '9999'; div.innerHTML = `<strong>${title}</strong><br>${message}`; document.body.appendChild(div); setTimeout(() => div.remove(), 3000); }

function logout() { localStorage.clear(); currentUser = null; cart = []; location.reload(); }