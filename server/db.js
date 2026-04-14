const mongoose = require('mongoose');
const fs = require('fs-extra');
const path = require('path');

const bookingsFile = path.join(__dirname, '../data/bookings.json');
const ordersFile = path.join(__dirname, '../data/orders.json');
const menuFile = path.join(__dirname, '../data/menu.json');
const tablesFile = path.join(__dirname, '../data/tables.json');
const TableModel = require('../models/Table');

let enabled = false;
let Booking = null;
let Order = null;
let MenuItem = null;

// Booking schema: mirrors existing JSON structure but with types
const BookingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  phone: { type: String },
  date: { type: String }, // stored as string in existing files (e.g., "2026-01-01")
  time: { type: String },
  guests: { type: Number },
  message: { type: String },
  status: { type: String, default: 'pending' },
  tableNumber: { type: Number },
  table: { type: Number },
  lastAssignedTable: { type: mongoose.Schema.Types.Mixed },
  allocatedAt: { type: Number },
  tableAssignedAt: { type: Number },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

// Order schema
const OrderItemSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  price: { type: Number },
  qty: { type: Number, default: 1 }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  items: { type: [OrderItemSchema], default: [] },
  phoneNumber: { type: String },
  tableNumber: { type: Number },
  total: { type: Number },
  status: { type: String, default: 'new' },
  createdAt: { type: Date, default: Date.now },
  serviceCharge: { type: Number },
  tax: { type: Number }
}, { strict: false });

// Menu item schema
const MenuSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String },
  price: { type: Number, default: 0 },
  category: { type: String },
  available: { type: Boolean, default: true }
}, { strict: false });

async function init() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('MongoDB URI not set; MongoDB disabled. Set MONGODB_URI to enable.');
    enabled = false;
    return false;
  }

  try {
    await mongoose.connect(uri, { connectTimeoutMS: 5000 });
    Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
    Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
    MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', MenuSchema);
    enabled = true;
    console.log('✅ MongoDB connected');
    return true;
  } catch (err) {
    console.warn('⚠️ MongoDB connect failed:', err && err.message ? err.message : err);
    enabled = false;
    return false;
  }
}

// Bookings
async function getBookings() {
  if (!enabled) throw new Error('MongoDB disabled');
  return Booking.find().lean().exec();
}

async function getBookingById(id) {
  if (!enabled) throw new Error('MongoDB disabled');
  return Booking.findOne({ id: String(id) }).lean().exec();
}

async function createBooking(data) {
  if (!enabled) throw new Error('MongoDB disabled');
  if (typeof data.id !== 'undefined') data.id = String(data.id);
  const doc = new Booking(data);
  await doc.save();
  return doc.toObject();
}

async function updateBooking(id, patch) {
  if (!enabled) throw new Error('MongoDB disabled');
  if (typeof patch.id !== 'undefined') delete patch.id;
  const b = await Booking.findOneAndUpdate({ id: String(id) }, { $set: patch }, { new: true, upsert: false }).lean().exec();
  return b;
}

async function deleteBooking(id) {
  if (!enabled) throw new Error('MongoDB disabled');
  return Booking.findOneAndDelete({ id: String(id) }).lean().exec();
}

async function clearBookings() {
  if (!enabled) throw new Error('MongoDB disabled');
  return Booking.deleteMany({}).exec();
}

async function migrateFromFile() {
  if (!enabled) throw new Error('MongoDB disabled');
  const exists = await fs.pathExists(bookingsFile);
  if (!exists) return { inserted: 0 };
  const arr = await fs.readJson(bookingsFile).catch(() => []);
  let inserted = 0;
  for (const b of arr || []) {
    try {
      if (typeof b.id === 'undefined') b.id = String(Date.now()) + Math.floor(Math.random() * 1000);
      b.id = String(b.id);
      // Upsert by id
      const res = await Booking.updateOne({ id: b.id }, { $setOnInsert: b }, { upsert: true }).exec();
      if (res && (res.upsertedCount || res.upsertedId)) inserted++;
    } catch (e) {
      // ignore duplicates
    }
  }
  return { inserted };
}

// Orders
async function getOrders() {
  if (!enabled) throw new Error('MongoDB disabled');
  return Order.find().lean().exec();
}

async function createOrder(data) {
  if (!enabled) throw new Error('MongoDB disabled');
  if (typeof data.id !== 'undefined') data.id = String(data.id);
  const doc = new Order(data);
  await doc.save();
  return doc.toObject();
}

async function updateOrder(id, patch) {
  if (!enabled) throw new Error('MongoDB disabled');
  const o = await Order.findOneAndUpdate({ id: String(id) }, { $set: patch }, { new: true }).lean().exec();
  return o;
}

async function deleteOrder(id) {
  if (!enabled) throw new Error('MongoDB disabled');
  return Order.findOneAndDelete({ id: String(id) }).lean().exec();
}

async function clearOrders() {
  if (!enabled) throw new Error('MongoDB disabled');
  return Order.deleteMany({}).exec();
}

// Menu
async function getMenu() {
  if (!enabled) throw new Error('MongoDB disabled');
  return MenuItem.find().lean().exec();
}

async function upsertMenuItem(item) {
  if (!enabled) throw new Error('MongoDB disabled');
  if (typeof item.id !== 'undefined') item.id = String(item.id);
  await MenuItem.updateOne({ id: item.id }, { $set: item }, { upsert: true }).exec();
  return await MenuItem.findOne({ id: item.id }).lean().exec();
}

// Tables (with MongoDB + file fallback)
async function getTables() {
  if (enabled) {
    return (TableModel && TableModel.find ? await TableModel.find().sort({ tableNumber: 1 }).lean().exec() : []);
  }
  const exists = await fs.pathExists(tablesFile);
  if (!exists) return [];
  return await fs.readJson(tablesFile).catch(() => []);
}

async function initTables(count = 10, overwrite = false) {
  count = parseInt(count, 10) || 10;
  if (enabled) {
    if (overwrite) await TableModel.deleteMany({}).exec();
    let created = 0;
    for (let i = 1; i <= count; i++) {
      try {
        const res = await TableModel.updateOne({ tableNumber: i }, { $setOnInsert: { tableNumber: i, status: 'free' } }, { upsert: true }).exec();
        if (res && (res.upsertedCount || res.upsertedId)) created++;
      } catch (e) { /* ignore */ }
    }
    return { created };
  }

  // File fallback
  const arr = overwrite ? [] : (await fs.readJson(tablesFile).catch(() => []));
  const existingNums = new Set((arr || []).map(t => Number(t.tableNumber)));
  let created = 0;
  for (let i = 1; i <= count; i++) {
    if (!existingNums.has(i)) {
      arr.push({ tableNumber: i, status: 'free' });
      created++;
    }
  }
  await fs.writeJson(tablesFile, arr, { spaces: 2 });
  return { created };
}

async function updateTable(tableNumber, patch) {
  tableNumber = Number(tableNumber);
  if (enabled) {
    const updated = await TableModel.findOneAndUpdate({ tableNumber }, { $set: patch }, { new: true }).lean().exec();
    return updated;
  }

  const arr = await fs.readJson(tablesFile).catch(() => []);
  const idx = (arr || []).findIndex(t => Number(t.tableNumber) === tableNumber);
  if (idx === -1) return null;
  arr[idx] = Object.assign({}, arr[idx], patch);
  await fs.writeJson(tablesFile, arr, { spaces: 2 });
  return arr[idx];
}

// Reserve a table (optionally by number). Returns updated table or null
async function reserveTable({ tableNumber, bookingId, orderId } = {}) {
  if (enabled) {
    if (typeof tableNumber !== 'undefined' && tableNumber !== null) {
      const updated = await TableModel.findOneAndUpdate({ tableNumber: Number(tableNumber) }, { $set: { status: 'booked', bookingId: bookingId ? String(bookingId) : undefined, orderId: orderId ? String(orderId) : undefined } }, { new: true }).lean().exec();
      return updated;
    }
    // find lowest-numbered free table (sort by tableNumber ascending)
    const free = await TableModel.findOneAndUpdate({ status: 'free' }, { $set: { status: 'booked', bookingId: bookingId ? String(bookingId) : undefined, orderId: orderId ? String(orderId) : undefined } }, { new: true, sort: { tableNumber: 1 } }).lean().exec();
    return free;
  }

  let arr = await fs.readJson(tablesFile).catch(() => []);
  // If no tables initialized, auto-initialize using env var or default (10)
  if (!arr || !arr.length) {
    const defaultCount = process.env.INIT_TABLES_COUNT ? parseInt(process.env.INIT_TABLES_COUNT, 10) : 10;
    await initTables(defaultCount, false);
    arr = await fs.readJson(tablesFile).catch(() => []);
  }

  if (typeof tableNumber !== 'undefined' && tableNumber !== null) {
    const idx = arr.findIndex(t => Number(t.tableNumber) === Number(tableNumber));
    if (idx === -1) return null;
    arr[idx] = Object.assign({}, arr[idx], { status: 'booked', bookingId: bookingId ? String(bookingId) : undefined, orderId: orderId ? String(orderId) : undefined });
    await fs.writeJson(tablesFile, arr, { spaces: 2 });
    return arr[idx];
  }

  // Find free tables and pick the one with the smallest tableNumber
  const frees = (arr || []).filter(t => String(t.status) === 'free' || !t.status);
  if (!frees.length) return null;
  const minTableNum = frees.reduce((min, t) => Math.min(min, Number(t.tableNumber)), Infinity);
  const idx = (arr || []).findIndex(t => Number(t.tableNumber) === minTableNum);
  if (idx === -1) return null;
  arr[idx] = Object.assign({}, arr[idx], { status: 'booked', bookingId: bookingId ? String(bookingId) : undefined, orderId: orderId ? String(orderId) : undefined });
  await fs.writeJson(tablesFile, arr, { spaces: 2 });
  return arr[idx];
}

// Free a table (clear booking/order association)
async function freeTable(tableNumber) {
  tableNumber = Number(tableNumber);
  if (enabled) {
    const updated = await TableModel.findOneAndUpdate({ tableNumber }, { $set: { status: 'free' }, $unset: { bookingId: '', orderId: '' } }, { new: true }).lean().exec();
    return updated;
  }

  const arr = await fs.readJson(tablesFile).catch(() => []);
  const idx = (arr || []).findIndex(t => Number(t.tableNumber) === tableNumber);
  if (idx === -1) return null;
  const newVal = Object.assign({}, arr[idx]);
  newVal.status = 'free';
  delete newVal.bookingId;
  delete newVal.orderId;
  arr[idx] = newVal;
  await fs.writeJson(tablesFile, arr, { spaces: 2 });
  return arr[idx];
}

// Clear all table allocations (mark all free and remove associations)
async function clearTableAllocations() {
  if (enabled) {
    await TableModel.updateMany({}, { $set: { status: 'free' }, $unset: { bookingId: '', orderId: '' } }).exec();
    return true;
  }

  const arr = await fs.readJson(tablesFile).catch(() => []);
  (arr || []).forEach(t => {
    t.status = 'free';
    delete t.bookingId;
    delete t.orderId;
  });
  await fs.writeJson(tablesFile, arr, { spaces: 2 });
  return true;
}

module.exports = {
  init,
  enabled: () => enabled,
  // Bookings
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
  clearBookings,
  migrateFromFile,
  // Orders
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  clearOrders,
  // Menu
  getMenu,
  upsertMenuItem,
  // Tables
  getTables,
  initTables,
  updateTable,
  reserveTable,
  freeTable,
  clearTableAllocations
};
