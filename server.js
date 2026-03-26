const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_grocery_ni_lang';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-me';

const uploadDir = path.join(__dirname, 'images', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const schemaOptions = { timestamps: true };
const ROLES = { DASHBOARD: 'dashboard', INVENTORY: 'inventory', REPORTS: 'reports' };
const redirectByRole = {
  [ROLES.DASHBOARD]: '/dashboard.html',
  [ROLES.INVENTORY]: '/inventory.html',
  [ROLES.REPORTS]: '/management.html'
};

const Category = mongoose.model('Category', new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#3b82f6' }
}, schemaOptions));

const Item = mongoose.model('Item', new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, unique: true, trim: true },
  category: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  minStock: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, default: '' },
  image: { type: String, default: '' }
}, schemaOptions));

const Order = mongoose.model('Order', new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: false },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' }
  }],
  totalItems: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, required: true, default: 'cash' },
  orderTime: { type: Date, required: true, default: Date.now }
}, schemaOptions));

const Counter = mongoose.model('Counter', new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true, default: 0 }
}, schemaOptions));

const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: [ROLES.DASHBOARD, ROLES.INVENTORY, ROLES.REPORTS] }
}, schemaOptions));

function normalizeDoc(doc) {
  const o = doc.toObject();
  o.id = o._id.toString();
  delete o._id;
  delete o.__v;
  return o;
}

function buildItemPayload(req) {
  const payload = {
    name: String(req.body.name || '').trim(),
    sku: String(req.body.sku || '').trim(),
    category: String(req.body.category || '').trim(),
    quantity: Number(req.body.quantity),
    minStock: Number(req.body.minStock),
    price: Number(req.body.price),
    description: String(req.body.description || '')
  };
  if (req.file) payload.image = `/images/uploads/${req.file.filename}`;
  else if (typeof req.body.image === 'string' && req.body.image.trim()) payload.image = req.body.image.trim();
  return payload;
}

function signAuthToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
}

function parseAuthToken(req) {
  const token = req.cookies?.auth_token;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const auth = parseAuthToken(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });
  req.auth = auth;
  next();
}

function requireAnyRole(roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

function requirePageRole(role) {
  return (req, res, next) => {
    const auth = parseAuthToken(req);
    if (!auth) return res.redirect('/login.html');
    if (auth.role !== role) return res.redirect(redirectByRole[auth.role] || '/login.html');
    return next();
  };
}

async function getNextOrderNumber() {
  const counter = await Counter.findOneAndUpdate({ key: 'orderNumber' }, { $inc: { value: 1 } }, { new: true, upsert: true });
  return `ORD-${String(counter.value).padStart(4, '0')}`;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/login', async (req, res) => {
  const { username, password, role, next } = req.body;
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const selectedRole = String(role || '').trim();
  const user = await User.findOne({ username: normalizedUsername });
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  const valid = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  if (selectedRole && selectedRole !== user.role) return res.status(401).json({ success: false, message: 'Role mismatch.' });

  const token = signAuthToken(normalizeDoc(user));
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 12 * 60 * 60 * 1000
  });

  const cleanedNext = typeof next === 'string' ? next.trim() : '';
  const allowedNext = {
    [ROLES.DASHBOARD]: '/dashboard.html',
    [ROLES.INVENTORY]: '/inventory.html',
    [ROLES.REPORTS]: '/management.html'
  }[user.role];

  const finalRedirect = cleanedNext && cleanedNext === allowedNext
    ? cleanedNext
    : (redirectByRole[user.role] || '/dashboard.html');

  res.json({ success: true, redirect: finalRedirect });
});

app.post('/logout', (_req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.auth.username, role: req.auth.role });
});

app.get('/api/categories', requireAuth, requireAnyRole([ROLES.DASHBOARD, ROLES.INVENTORY, ROLES.REPORTS]), async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json(categories.map(normalizeDoc));
});

app.post('/api/categories', requireAuth, requireAnyRole([ROLES.INVENTORY]), async (req, res) => {
  const { name, description = '', color = '#3b82f6' } = req.body;
  const created = await Category.create({ name, description, color });
  res.status(201).json(normalizeDoc(created));
});

app.put('/api/categories/:id', requireAuth, requireAnyRole([ROLES.INVENTORY]), async (req, res) => {
  const { name, description = '', color = '#3b82f6' } = req.body;
  const updated = await Category.findByIdAndUpdate(req.params.id, { name, description, color }, { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: 'Category not found' });
  res.json(normalizeDoc(updated));
});

app.delete('/api/categories/:id', requireAuth, requireAnyRole([ROLES.INVENTORY]), async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });
  const itemsUsingCategory = await Item.countDocuments({ category: category.name });
  if (itemsUsingCategory > 0) return res.status(400).json({ message: `Cannot delete category. ${itemsUsingCategory} items are using this category.` });
  await category.deleteOne();
  res.json({ success: true });
});

app.get('/api/items', requireAuth, requireAnyRole([ROLES.DASHBOARD, ROLES.INVENTORY, ROLES.REPORTS]), async (_req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items.map(normalizeDoc));
});

app.post('/api/items', requireAuth, requireAnyRole([ROLES.INVENTORY]), upload.single('imageFile'), async (req, res) => {
  const created = await Item.create(buildItemPayload(req));
  res.status(201).json(normalizeDoc(created));
});

app.put('/api/items/:id', requireAuth, requireAnyRole([ROLES.INVENTORY]), upload.single('imageFile'), async (req, res) => {
  const updated = await Item.findByIdAndUpdate(req.params.id, buildItemPayload(req), { new: true, runValidators: true });
  if (!updated) return res.status(404).json({ message: 'Item not found' });
  res.json(normalizeDoc(updated));
});

app.delete('/api/items/:id', requireAuth, requireAnyRole([ROLES.INVENTORY]), async (req, res) => {
  const deleted = await Item.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Item not found' });
  res.json({ success: true });
});

app.get('/api/pos/catalog', requireAuth, requireAnyRole([ROLES.DASHBOARD]), async (_req, res) => {
  const items = await Item.find({ quantity: { $gt: 0 } }).sort({ name: 1 });
  res.json(items.map((doc) => {
    const item = normalizeDoc(doc);
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      image: item.image || '/images/placeholder.png',
      description: item.description || '',
      quantity: item.quantity
    };
  }));
});

app.get('/api/orders', requireAuth, requireAnyRole([ROLES.DASHBOARD, ROLES.REPORTS]), async (_req, res) => {
  const orders = await Order.find().sort({ orderTime: -1 });
  res.json(orders.map(normalizeDoc));
});

app.get('/api/orders/next-number', requireAuth, requireAnyRole([ROLES.DASHBOARD]), async (_req, res) => {
  const counter = await Counter.findOne({ key: 'orderNumber' });
  const next = (counter?.value || 0) + 1;
  res.json({ orderNumber: `ORD-${String(next).padStart(4, '0')}` });
});

app.post('/api/orders', requireAuth, requireAnyRole([ROLES.DASHBOARD]), async (req, res) => {
  const payload = req.body || {};
  if (!Array.isArray(payload.items) || payload.items.length === 0) return res.status(400).json({ message: 'Order requires at least one item.' });

  // Validate stock levels before creating the order.
  // This prevents placing orders for items that are out of stock or would go negative.
  const validatedItems = payload.items
    .filter((i) => i && i.itemId)
    .map((i) => ({
      ...i,
      itemId: String(i.itemId),
      quantity: Number(i.quantity) || 0,
    }));

  if (validatedItems.length === 0) {
    return res.status(400).json({ message: 'Order requires at least one valid item.' });
  }

  for (const orderItem of validatedItems) {
    if (orderItem.quantity <= 0) {
      return res.status(400).json({ message: 'Item quantities must be greater than 0.' });
    }
  }

  const itemIds = [...new Set(validatedItems.map((i) => i.itemId))];
  const dbItems = await Item.find({ _id: { $in: itemIds } });
  const itemsById = new Map(dbItems.map((doc) => [String(doc._id), doc]));

  for (const orderItem of validatedItems) {
    const item = itemsById.get(orderItem.itemId);
    if (!item) {
      return res.status(400).json({ message: 'One or more items no longer exist.' });
    }
    if (Number(item.quantity) < orderItem.quantity) {
      return res.status(400).json({
        message: `Insufficient stock for ${item.name}. Available: ${item.quantity}`,
      });
    }
  }

  const orderNumber = await getNextOrderNumber();
  const totalItems = validatedItems.reduce((sum, i) => sum + i.quantity, 0);
  const order = await Order.create({
    orderNumber,
    items: validatedItems,
    totalItems: Number(payload.totalItems) || totalItems,
    subtotal: Number(payload.subtotal) || 0,
    tax: Number(payload.tax) || 0,
    total: Number(payload.total) || 0,
    paymentMethod: payload.paymentMethod || 'cash',
    orderTime: payload.orderTime ? new Date(payload.orderTime) : new Date()
  });

  for (const orderItem of validatedItems) {
    await Item.findByIdAndUpdate(orderItem.itemId, { $inc: { quantity: -orderItem.quantity } });
  }
  res.status(201).json(normalizeDoc(order));
});

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get('/login.html', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard.html', requirePageRole(ROLES.DASHBOARD), (_req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/inventory.html', requirePageRole(ROLES.INVENTORY), (_req, res) => res.sendFile(path.join(__dirname, 'public', 'inventory.html')));
app.get('/management.html', requirePageRole(ROLES.REPORTS), (_req, res) => res.sendFile(path.join(__dirname, 'public', 'management.html')));
app.get('/', (_req, res) => res.redirect('/login.html'));

async function seedInitialData() {
  const seedCategories = [
    { name: 'Fruits & Vegetables', description: 'Fresh produce', color: '#16a34a' },
    { name: 'Meat & Seafood', description: 'Fresh and frozen meat and seafood', color: '#dc2626' },
    { name: 'Dairy & Eggs', description: 'Milk, cheese, eggs', color: '#2563eb' },
    { name: 'Snacks & Confectionery', description: 'Snacks and sweets', color: '#f97316' },
    { name: 'Drinks', description: 'Beverages', color: '#06b6d4' },
    { name: 'Frozen Foods', description: 'Frozen ready-to-cook items', color: '#7c3aed' }
  ];
  for (const category of seedCategories) {
    await Category.updateOne(
      { name: category.name },
      { $setOnInsert: category },
      { upsert: true }
    );
  }

  if (!(await Item.countDocuments())) {
    await Item.insertMany([
      { name: 'Rice', sku: 'SKU-RICE-001', category: 'Fruits & Vegetables', quantity: 120, minStock: 20, price: 8.99, description: 'Premium rice', image: '/images/rice.jfif' },
      { name: 'Milk', sku: 'SKU-MILK-001', category: 'Dairy & Eggs', quantity: 60, minStock: 15, price: 12.99, description: 'Fresh milk', image: '/images/milk.jfif' },
      { name: 'Bread', sku: 'SKU-BRED-001', category: 'Fruits & Vegetables', quantity: 40, minStock: 10, price: 9.99, description: 'Soft bread', image: '/images/bread.jfif' },
      { name: 'Egg', sku: 'SKU-EGG-001', category: 'Dairy & Eggs', quantity: 200, minStock: 30, price: 11.99, description: 'Farm eggs', image: '/images/egg.jfif' }
    ]);
  }

  const seedUsers = [
    { username: 'dashboard', password: 'dashboard123', role: ROLES.DASHBOARD },
    { username: 'inventory', password: 'inventory123', role: ROLES.INVENTORY },
    { username: 'reports', password: 'reports123', role: ROLES.REPORTS }
  ];

  for (const entry of seedUsers) {
    const username = entry.username.toLowerCase();
    const existing = await User.findOne({ username });
    if (!existing) {
      const passwordHash = await bcrypt.hash(entry.password, 10);
      await User.create({ username, passwordHash, role: entry.role });
      continue;
    }
    if (!existing.passwordHash || !existing.passwordHash.startsWith('$2')) {
      existing.passwordHash = await bcrypt.hash(entry.password, 10);
      await existing.save();
    }
  }
}

async function bootstrap() {
  await mongoose.connect(MONGO_URI);
  await seedInitialData();
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
