const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Nodemailer transporter (initialized if SMTP env vars provided)
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  transporter.verify()
    .then(() => {
      console.log('✅ SMTP Email configured successfully');
      console.log('   📧 Using:', process.env.SMTP_USER);
      console.log('   📤 Host:', process.env.SMTP_HOST || 'smtp.gmail.com');
    })
    .catch(err => {
      console.error('❌ SMTP configuration error:');
      console.error('   Error:', err && err.message ? err.message : err);
      console.error('   Check SMTP_USER, SMTP_PASSWORD, SMTP_HOST in .env');
      transporter = null; // disable email if verification fails
    });
} else {
  console.warn('⚠️ Email not configured');
  console.warn('   Set SMTP_USER and SMTP_PASSWORD in .env to enable email receipts');
}

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const PORT = process.env.PORT || 5000;

// create http server and Socket.IO server
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.use('/api/', limiter);

// Data file paths
const ordersFile = path.join(__dirname, '../data/orders.json');
const bookingsFile = path.join(__dirname, '../data/bookings.json');
const menuFile = path.join(__dirname, '../data/menu.json');
const tablesFile = path.join(__dirname, '../data/tables.json');

// Initialize data files
const initFiles = async () => {
  if (!await fs.exists(ordersFile)) {
    await fs.writeJson(ordersFile, []);
  }
  if (!await fs.exists(bookingsFile)) {
    await fs.writeJson(bookingsFile, []);
  }
  if (!await fs.exists(menuFile)) {
    await fs.writeJson(menuFile, []);
  }
  if (!await fs.exists(tablesFile)) {
    await fs.writeJson(tablesFile, []);
  }
};

initFiles();
const db = require('./db');
// Initialize DB (if MONGODB_URI is set). Optionally migrate by setting MIGRATE_BOOKINGS_ON_START=true
(async () => {
  try {
    const ok = await db.init().catch(() => false);
    if (ok && process.env.MIGRATE_BOOKINGS_ON_START === 'true') {
      const r = await db.migrateFromFile().catch(e => ({ inserted: 0, error: e }));
      console.log('Bookings migration result:', r);
    }

    // Auto-initialize tables on start if requested
    const initTablesCount = process.env.INIT_TABLES_COUNT ? parseInt(process.env.INIT_TABLES_COUNT, 10) : 0;
    const initTablesOverwrite = (process.env.INIT_TABLES_OVERWRITE === 'true');
    if (ok && initTablesCount > 0) {
      try {
        const t = await db.initTables(initTablesCount, initTablesOverwrite);
        console.log(`Initialized ${t && t.created ? t.created : 0} tables (INIT_TABLES_COUNT=${initTablesCount})`);
      } catch (e) { console.warn('Failed to initialize tables on start', e); }
    }
  } catch (e) { /* ignore */ }
})();

// Date formatter (dd/mm/yyyy, hh:mm:ss)
function formatDateTime(value, includeTime = true) {
  if (!value && value !== 0) return 'N/A';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  if (!includeTime) return `${dd}/${mm}/${yyyy}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
}

// Helper: send receipt email via nodemailer
async function sendReceiptEmail(email, phone, order, tableNumber) {
  if (!transporter) {
    console.warn('SMTP transporter not configured; email sending disabled');
    return { success: false, reason: 'smtp_not_configured' };
  }

  try {
    // Build items list and compute billing breakdown (subtotal, tax, service charge, total)
    const items = (order.items || []).map(i => ({
      name: i.name,
      qty: parseInt(i.qty || 1, 10),
      price: parseFloat(i.price || 0)
    }));

    const itemsList = items
      .map(item => `<li>${item.name} x${item.qty} - ₹${(item.price * item.qty).toFixed(2)}</li>`)
      .join('');

    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const tax = +(subtotal * 0.02); // 2% tax
    // Use provided serviceCharge if present, otherwise default to fee from order
    const serviceCharge = typeof order.serviceCharge !== 'undefined' && order.serviceCharge !== null
      ? parseFloat(order.serviceCharge)
      : 2; // Default ₹2 service fee
    const total = +(subtotal + tax + serviceCharge);

    const htmlContent = `
      <h2>Love-Bite Restaurant - Order Receipt</h2>
      <p>Dear Customer,</p>
      <p>Thank you for your order! Here are your order details:</p>

      <h3>Order Details</h3>
      <ul>
        <li><strong>Order ID:</strong> ${order.id}</li>
        <li><strong>Date:</strong> ${formatDateTime(order.date)}</li>
        <li><strong>Phone:</strong> ${phone}</li>
        <li><strong>Table Number:</strong> ${tableNumber || 'N/A'}</li>
      </ul>

      <h3>Items Ordered</h3>
      <ul>
        ${itemsList}
      </ul>

      <h3>Billing Summary</h3>
      <ul>
        <li><strong>Subtotal:</strong> ₹${subtotal.toFixed(2)}</li>
        <li><strong>Tax (2%):</strong> ₹${tax.toFixed(2)}</li>
        <li><strong>Service Charge:</strong> ₹${serviceCharge.toFixed(2)}</li>
        <li><strong>Total:</strong> ₹${total.toFixed(2)}</li>
      </ul>

      <p>Your order has been confirmed and will be prepared shortly.</p>
      <p>Best regards,<br/>Love-Bite Restaurant Team</p>
      <p style="font-size:0.9em;color:#666;margin-top:8px;">Made by Shreyas Kulkarni</p>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: `Order Confirmation - Love-Bite Restaurant #${order.id}`,
      html: htmlContent
    });

    console.log('✅ Email receipt sent successfully to:', email);
    console.log('   📧 Message ID:', info.messageId);
    console.log('   💰 Order total: ₹' + total.toFixed(2));
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email sending failed for:', email);
    console.error('   Error:', error.message);
    console.error('   Make sure SMTP_USER and SMTP_PASSWORD are set in .env');
    return { success: false, error: error.message };
  }
}

// Note: SMS (Fast2SMS) integration removed — receipts are sent via email only.

// Routes

// GET /api/menu - Get all menu items
app.get('/api/menu', async (req, res) => {
  try {
    const menu = await fs.readJson(menuFile);
    res.json(menu);
  } catch (error) {
    console.error('Error reading menu:', error);
    res.json([]);
  }
});

// POST /api/orders - Create a new order
app.post('/api/orders', async (req, res) => {
  try {
    const orders = await fs.readJson(ordersFile);
    // Prefer client-provided id when available to keep client/server in sync
    const clientId = req.body && req.body.id ? req.body.id : null;
    const newOrder = {
      ...req.body,
      id: clientId || Date.now(),
      createdAt: new Date().toISOString()
    };

    orders.push(newOrder);
    await fs.writeJson(ordersFile, orders, { spaces: 2 });

    // Emit real-time event for connected manager dashboards
    try { io && io.emit('new-order', newOrder); } catch (e) { console.warn('Socket emit new-order failed', e); }
    try { io && io.emit('sync-data', { orders, bookings: await fs.readJson(bookingsFile) }); } catch (e) { /* ignore */ }

    res.status(201).json({ success: true, orderId: newOrder.id });
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

// GET /api/orders - Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await fs.readJson(ordersFile);
    res.json(orders);
  } catch (error) {
    console.error('Error reading orders:', error);
    res.json([]);
  }
});

// POST /api/bookings - Create a new booking (uses MongoDB when configured)
app.post('/api/bookings', async (req, res) => {
  try {
    // Prefer client-provided id when available to keep client/server in sync
    const clientId = req.body && req.body.id ? req.body.id : null;
    const payload = {
      ...req.body,
      id: clientId || String(Date.now()),
      createdAt: new Date().toISOString()
    };

    let savedBooking = null;
    if (db.enabled()) {
      try {
        savedBooking = await db.createBooking(payload);
      } catch (e) {
        console.warn('MongoDB save failed, falling back to file:', e && e.message ? e.message : e);
      }
    }

    if (!savedBooking) {
      // Fallback to file storage
      const bookings = await fs.readJson(bookingsFile);
      bookings.push(payload);
      await fs.writeJson(bookingsFile, bookings, { spaces: 2 });
      savedBooking = payload;
    }

    // Emit real-time booking event and a sync for connected clients
    try { io && io.emit('new-booking', savedBooking); } catch (e) { console.warn('Socket emit new-booking failed', e); }
    try { io && io.emit('sync-data', { orders: await fs.readJson(ordersFile), bookings: db.enabled() ? await db.getBookings() : await fs.readJson(bookingsFile) }); } catch (e) { /* ignore */ }

    // If phone provided, attempt to send an SMS with slot/table details
    let smsResult = { success: false, reason: 'skipped' };
    const phone = (savedBooking.phone || req.body.phone || '').toString().trim();
    if (phone) {
      try {
        const slot = savedBooking.slot || savedBooking.slotNumber || savedBooking.table || savedBooking.tableNumber || req.body.slot || 'N/A';
        const dateStr = savedBooking.date ? formatDateTime(savedBooking.date, false) : 'N/A';
        const smsBody = `Love-Bite: Booking #${savedBooking.id} | Slot: ${slot} | Date: ${dateStr}`;
        smsResult = await sendSms(phone, smsBody);
        console.log('Booking SMS result:', smsResult);
      } catch (smsErr) {
        console.error('Error sending booking SMS:', smsErr);
      }
    }

    res.status(201).json({ success: true, bookingId: savedBooking.id, sms: smsResult });
  } catch (error) {
    console.error('Error saving booking:', error);
    res.status(500).json({ error: 'Failed to save booking' });
  }
});

// GET /api/bookings - Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    if (db.enabled()) {
      const bookings = await db.getBookings();
      return res.json(bookings || []);
    }
    const bookings = await fs.readJson(bookingsFile);
    res.json(bookings);
  } catch (error) {
    console.error('Error reading bookings:', error);
    res.json([]);
  }
});

// DELETE /api/orders/clear - clear all orders (admin convenience)
app.delete('/api/orders/clear', async (req, res) => {
  try {
    await fs.writeJson(ordersFile, [], { spaces: 2 });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to clear orders:', err);
    res.status(500).json({ error: 'Failed to clear orders' });
  }
});

// DELETE /api/bookings/clear - clear all bookings (admin convenience)
app.delete('/api/bookings/clear', async (req, res) => {
  try {
    if (db.enabled()) {
      await db.clearBookings();
      try { io && io.emit('sync-data', { bookings: [], orders: await fs.readJson(ordersFile), menu: await fs.readJson(menuFile) }); } catch (e) { /* ignore */ }
      return res.json({ success: true });
    }

    await fs.writeJson(bookingsFile, [], { spaces: 2 });
    try { io && io.emit('sync-data', { bookings: [], orders: await fs.readJson(ordersFile), menu: await fs.readJson(menuFile) }); } catch (e) { /* ignore */ }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to clear bookings:', err);
    res.status(500).json({ error: 'Failed to clear bookings' });
  }
});

// PUT /api/bookings/:id - Update a booking (replace/merge)
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (db.enabled()) {
      const updated = await db.updateBooking(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Booking not found' });
      try { io && io.emit('sync-data', { bookings: await db.getBookings(), orders: await fs.readJson(ordersFile), menu: await fs.readJson(menuFile) }); } catch (e) {}
      return res.json(updated);
    }

    const bookings = await fs.readJson(bookingsFile);
    const idx = bookings.findIndex(b => String(b.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Booking not found' });
    // Replace or merge based on payload
    bookings[idx] = Object.assign({}, bookings[idx], req.body);
    await fs.writeJson(bookingsFile, bookings, { spaces: 2 });
    try { io && io.emit('sync-data', { bookings, orders: await fs.readJson(ordersFile), menu: await fs.readJson(menuFile) }); } catch (e) { /* ignore */ }
    res.json(bookings[idx]);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// PATCH /api/bookings/:id - Partial update a booking
app.patch('/api/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (db.enabled()) {
      const updated = await db.updateBooking(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Booking not found' });
      try { io && io.emit('sync-data', { bookings: await db.getBookings(), orders: await fs.readJson(ordersFile), menu: await fs.readJson(menuFile) }); } catch (e) {}
      return res.json(updated);
    }

    const bookings = await fs.readJson(bookingsFile);
    const idx = bookings.findIndex(b => String(b.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Booking not found' });
    bookings[idx] = Object.assign({}, bookings[idx], req.body);
    await fs.writeJson(bookingsFile, bookings, { spaces: 2 });
    try { io && io.emit('sync-data', { bookings, orders: await fs.readJson(ordersFile), menu: await fs.readJson(menuFile) }); } catch (e) { /* ignore */ }
    res.json(bookings[idx]);
  } catch (error) {
    console.error('Error patching booking:', error);
    res.status(500).json({ error: 'Failed to patch booking' });
  }
});

// DELETE /api/bookings/:id - delete a single booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (db.enabled()) {
      const removed = await db.deleteBooking(id);
      if (!removed) return res.status(404).json({ error: 'Booking not found' });
      try { io && io.emit('sync-data', { bookings: await db.getBookings(), orders: await fs.readJson(ordersFile) }); } catch (e) {}
      return res.json({ success: true, removed });
    }

    const bookings = await fs.readJson(bookingsFile);
    const idx = bookings.findIndex(b => String(b.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Booking not found' });
    const removed = bookings.splice(idx, 1)[0];
    await fs.writeJson(bookingsFile, bookings, { spaces: 2 });
    try { io && io.emit('sync-data', { bookings, orders: await fs.readJson(ordersFile) }); } catch (e) { /* ignore */ }
    res.json({ success: true, removed });
  } catch (err) {
    console.error('Failed to delete booking:', err);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// DELETE /api/orders/clear - clear all orders (admin convenience)
// API: Tables
// GET /api/tables - list all tables
app.get('/api/tables', async (req, res) => {
  try {
    const tables = db.enabled() ? await db.getTables() : await fs.readJson(tablesFile).catch(() => []);
    res.json(tables || []);
  } catch (err) {
    console.error('Error getting tables:', err);
    res.status(500).json({ error: 'Failed to get tables' });
  }
});

// POST /api/tables/init - initialize tables (body: { count: 10, overwrite: false })
app.post('/api/tables/init', async (req, res) => {
  try {
    const count = parseInt(req.body && req.body.count ? req.body.count : 10, 10) || 10;
    const overwrite = !!(req.body && req.body.overwrite);
    const r = await db.initTables(count, overwrite).catch(async (e) => {
      // Fallback: if db.disabled, initTables will handle file fallback
      return await db.initTables(count, overwrite);
    });
    try { io && io.emit('sync-data', { bookings: db.enabled() ? await db.getBookings() : await fs.readJson(bookingsFile), orders: db.enabled() ? await db.getOrders() : await fs.readJson(ordersFile), tables: await db.getTables() }); } catch (e) {}
    res.json({ success: true, created: r && r.created ? r.created : 0 });
  } catch (err) {
    console.error('Failed to init tables:', err);
    res.status(500).json({ error: 'Failed to initialize tables' });
  }
});

// POST /api/tables/reserve - Reserve a table (body: { tableNumber?, bookingId?, orderId? })
app.post('/api/tables/reserve', async (req, res) => {
  try {
    const { tableNumber, bookingId, orderId } = req.body || {};
    const reserved = await db.reserveTable({ tableNumber, bookingId, orderId }).catch(async (e) => {
      // fallback handled inside db
      return null;
    });

    if (!reserved) return res.status(404).json({ error: 'No free table found or table not found' });

    // If bookingId provided, persist on booking record
    if (bookingId) {
      try {
        if (db.enabled()) {
          await db.updateBooking(bookingId, { lastAssignedTable: reserved.tableNumber, tableAssignedAt: Date.now() });
        } else {
          const bookings = await fs.readJson(bookingsFile).catch(() => []);
          const idx = bookings.findIndex(b => String(b.id) === String(bookingId));
          if (idx !== -1) {
            bookings[idx].lastAssignedTable = String(reserved.tableNumber);
            bookings[idx].tableAssignedAt = Date.now();
            await fs.writeJson(bookingsFile, bookings, { spaces: 2 });
          }
        }
      } catch (e) { console.warn('Failed to persist booking assignment', e); }
    }

    try { io && io.emit('table-updated', reserved); } catch (e) {}
    try { io && io.emit('sync-data', { bookings: db.enabled() ? await db.getBookings() : await fs.readJson(bookingsFile), orders: db.enabled() ? await db.getOrders() : await fs.readJson(ordersFile), tables: await db.getTables() }); } catch (e) {}

    res.json({ success: true, reserved });
  } catch (err) {
    console.error('Failed to reserve table:', err);
    res.status(500).json({ error: 'Failed to reserve table' });
  }
});

// POST /api/tables/free - Free a table (body: { tableNumber })
app.post('/api/tables/free', async (req, res) => {
  try {
    const tableNumber = req.body && req.body.tableNumber ? req.body.tableNumber : null;
    if (!tableNumber) return res.status(400).json({ error: 'tableNumber required' });
    const freed = await db.freeTable(tableNumber);
    if (!freed) return res.status(404).json({ error: 'Table not found' });
    try { io && io.emit('table-updated', freed); } catch (e) {}
    try { io && io.emit('sync-data', { bookings: db.enabled() ? await db.getBookings() : await fs.readJson(bookingsFile), orders: db.enabled() ? await db.getOrders() : await fs.readJson(ordersFile), tables: await db.getTables() }); } catch (e) {}
    res.json({ success: true, freed });
  } catch (err) {
    console.error('Failed to free table:', err);
    res.status(500).json({ error: 'Failed to free table' });
  }
});

// PATCH /api/tables/:tableNumber - update table status (body: { status: 'free'|'booked' })
app.patch('/api/tables/:tableNumber', async (req, res) => {
  try {
    const tableNumber = req.params.tableNumber;
    const patch = req.body || {};
    const updated = await db.updateTable(tableNumber, patch);
    if (!updated) return res.status(404).json({ error: 'Table not found' });
    try { io && io.emit('table-updated', updated); } catch (e) {}
    try { io && io.emit('sync-data', { bookings: db.enabled() ? await db.getBookings() : await fs.readJson(bookingsFile), orders: db.enabled() ? await db.getOrders() : await fs.readJson(ordersFile), tables: await db.getTables() }); } catch (e) {}
    res.json(updated);
  } catch (err) {
    console.error('Failed to update table:', err);
    res.status(500).json({ error: 'Failed to update table' });
  }
});


// --- Convenience endpoints for multi-device demo (public/simple)

// POST /book-table - Book a specific table (body: { tableNumber })
app.post('/book-table', async (req, res) => {
  try {
    const { tableNumber } = req.body || {};
    if (typeof tableNumber === 'undefined' || tableNumber === null) return res.status(400).json({ error: 'tableNumber required' });

    // Try DB first, fallback to file-backed reserve
    let reserved = null;
    if (db.enabled()) {
      try { reserved = await db.reserveTable({ tableNumber: Number(tableNumber) }); } catch (e) { console.warn('DB reserve failed', e && e.message ? e.message : e); }
    }
    if (!reserved) {
      // File fallback
      const arr = await fs.readJson(tablesFile).catch(() => []);
      const idx = (arr || []).findIndex(t => Number(t.tableNumber) === Number(tableNumber));
      if (idx === -1) return res.status(404).json({ error: 'Table not found' });
      if (String(arr[idx].status) === 'booked') return res.status(400).send('Already booked');
      arr[idx].status = 'booked';
      await fs.writeJson(tablesFile, arr, { spaces: 2 });
      reserved = arr[idx];
    }

    try { io && io.emit('table-updated', reserved); } catch (e) {}
    try { io && io.emit('sync-data', { bookings: db.enabled() ? await db.getBookings() : await fs.readJson(bookingsFile), orders: db.enabled() ? await db.getOrders() : await fs.readJson(ordersFile), tables: await db.getTables() }); } catch (e) {}

    res.json({ success: true, reserved });
  } catch (err) {
    console.error('Failed to book table:', err);
    res.status(500).json({ error: 'Failed to book table' });
  }
});

// POST /order - Create a new order (any device)
app.post('/order', async (req, res) => {
  try {
    const clientId = req.body && req.body.id ? req.body.id : null;
    const payload = { ...req.body, id: clientId || String(Date.now()), createdAt: new Date().toISOString() };

    let savedOrder = null;
    if (db.enabled()) {
      try { savedOrder = await db.createOrder(payload); } catch (e) { console.warn('DB createOrder failed', e && e.message ? e.message : e); }
    }

    if (!savedOrder) {
      // File fallback
      const orders = await fs.readJson(ordersFile).catch(() => []);
      orders.push(payload);
      await fs.writeJson(ordersFile, orders, { spaces: 2 });
      savedOrder = payload;
    }

    // If order included tableNumber, try to reserve that table and attach orderId
    try {
      if (savedOrder.tableNumber) {
        if (db.enabled()) {
          try { await db.reserveTable({ tableNumber: Number(savedOrder.tableNumber), orderId: String(savedOrder.id) }); } catch (e) { /* ignore */ }
        } else {
          const tarr = await fs.readJson(tablesFile).catch(() => []);
          const tidx = (tarr || []).findIndex(t => Number(t.tableNumber) === Number(savedOrder.tableNumber));
          if (tidx !== -1) { tarr[tidx].status = 'booked'; tarr[tidx].orderId = String(savedOrder.id); await fs.writeJson(tablesFile, tarr, { spaces: 2 }); }
        }
      }
    } catch (e) { console.warn('Failed to associate table for order', e); }

    try { io && io.emit('new-order', savedOrder); } catch (e) { console.warn('Socket emit new-order failed', e); }
    try { io && io.emit('sync-data', { orders: db.enabled() ? await db.getOrders() : await fs.readJson(ordersFile), bookings: db.enabled() ? await db.getBookings() : await fs.readJson(bookingsFile), tables: await db.getTables() }); } catch (e) {}

    res.status(201).json({ success: true, order: savedOrder });
  } catch (err) {
    console.error('Failed to create order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /admin/orders - Admin: list all orders (most recent first)
app.get('/admin/orders', async (req, res) => {
  try {
    let orders = [];
    if (db.enabled()) {
      try { orders = await db.getOrders(); } catch (e) { console.warn('DB getOrders failed', e && e.message ? e.message : e); }
    }
    if (!orders || !orders.length) orders = await fs.readJson(ordersFile).catch(() => []);
    // normalize createdAt and sort
    orders = (orders || []).map(o => ({ ...o, createdAt: o.createdAt || o.created || new Date().toISOString() }));
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(orders);
  } catch (err) {
    console.error('Failed to get admin orders:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// GET /admin/tables - Admin: get all tables
app.get('/admin/tables', async (req, res) => {
  try {
    const tables = await db.getTables().catch(async (e) => { return await fs.readJson(tablesFile).catch(() => []); });
    res.json(tables);
  } catch (err) {
    console.error('Failed to get tables:', err);
    res.status(500).json({ error: 'Failed to get tables' });
  }
});

// POST /api/send-receipt - Send order receipt via email
app.post('/api/send-receipt', async (req, res) => {
  try {
    const { email, phone, order } = req.body;
    
    console.log('📬 Receipt request received');
    console.log('   Email:', email ? '✓ ' + email : '✗ not provided');
    console.log('   Order ID:', order?.id);
    
    // Email is required for receipt delivery
    if (!email) {
      console.warn('⚠️ Receipt request rejected: email not provided');
      return res.status(400).json({ error: 'Email is required for receipt' });
    }

    // Extract table number from order or request body
    const tableNo = order?.table || order?.tableNumber || req.body.tableNumber || 'N/A';

    // Send email receipt
    let emailResult = { success: false, reason: 'skipped' };
    console.log('📧 Attempting email receipt...');
    try {
      emailResult = await sendReceiptEmail(email, phone, order, tableNo);
    } catch (emailErr) {
      console.error('❌ Email receipt error:', emailErr);
      emailResult = { success: false, error: emailErr.message };
    }
    
    if (emailResult.success) {
      console.log('✅ Receipt delivery completed');
    } else {
      console.warn('⚠️ Email sending failed (check logs above for details)');
    }
    
    res.status(200).json({ 
      success: !!emailResult.success,
      message: 'Receipt delivery attempted',
      orderId: order.id,
      email: emailResult
    });
  } catch (error) {
    console.error('Error sending receipt:', error);
    res.status(500).json({ error: 'Failed to send receipt' });
  }
});

// POST /api/admin/login - Admin login with bcrypt password hashing
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Demo credentials - in production, fetch from database
    const demoPassword = 'shreyas123';
    
    if ((email === 'shreyas' || email === 'admin') && password === demoPassword) {
      const token = 'token_' + Date.now();
      res.json({ 
        success: true, 
        token: token,
        email: email
      });
    } else {
      res.status(401).json({ 
        message: 'Invalid credentials' 
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Clear all orders (used by manager dashboard)
app.delete('/api/orders/clear', async (req, res) => {
  try {
    await fs.writeJson(ordersFile, []);
    const orders = [];
    const bookings = await fs.readJson(bookingsFile).catch(() => []);
    try { io && io.emit('sync-data', { orders, bookings }); } catch (e) { /* ignore */ }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to clear orders:', err);
    res.status(500).json({ success: false });
  }
});

// Clear all bookings (used by manager dashboard)
app.delete('/api/bookings/clear', async (req, res) => {
  try {
    if (db.enabled()) {
      await db.clearBookings();
      const bookings = [];
      const orders = await fs.readJson(ordersFile).catch(() => []);
      try { io && io.emit('sync-data', { orders, bookings }); } catch (e) { /* ignore */ }
      return res.json({ success: true });
    }

    await fs.writeJson(bookingsFile, []);
    const bookings = [];
    const orders = await fs.readJson(ordersFile).catch(() => []);
    try { io && io.emit('sync-data', { orders, bookings }); } catch (e) { /* ignore */ }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to clear bookings:', err);
    res.status(500).json({ success: false });
  }
});

// DELETE /api/allocations/clear - Clear table allocations (bookings/orders/tables)
app.delete('/api/allocations/clear', async (req, res) => {
  try {
    // Remove allocation-related properties from bookings
    const bookings = await fs.readJson(bookingsFile).catch(() => []);
    const orders = await fs.readJson(ordersFile).catch(() => []);

    let bookingsModified = 0;
    let ordersModified = 0;

    (bookings || []).forEach(b => {
      let changed = false;
      ['tableNumber', 'table', 'lastAssignedTable', 'allocatedAt', 'tableAssignedAt', 'tableFreedAt'].forEach(k => {
        if (typeof b[k] !== 'undefined') { delete b[k]; changed = true; }
      });
      if (changed) bookingsModified++;
    });

    (orders || []).forEach(o => {
      let changed = false;
      ['tableNumber', 'table'].forEach(k => {
        if (typeof o[k] !== 'undefined') { delete o[k]; changed = true; }
      });
      if (changed) ordersModified++;
    });

    await fs.writeJson(bookingsFile, bookings, { spaces: 2 });
    await fs.writeJson(ordersFile, orders, { spaces: 2 });

    // Also clear tables allocation state
    try { await db.clearTableAllocations(); } catch (e) { /* ignore */ }

    try { io && io.emit('sync-data', { bookings: db.enabled() ? await db.getBookings() : bookings, orders: db.enabled() ? await db.getOrders() : orders, tables: db.enabled() ? await db.getTables() : await fs.readJson(tablesFile).catch(() => []) }); } catch (e) { /* ignore */ }

    res.json({ success: true, bookingsModified, ordersModified });
  } catch (err) {
    console.error('Failed to clear allocations:', err);
    res.status(500).json({ error: 'Failed to clear allocations' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO connection handling
io.on('connection', socket => {
  console.log('Socket client connected:', socket.id);
  // send full sync on new connection
  (async () => {
    try {
      const orders = await fs.readJson(ordersFile).catch(() => []);
      const bookings = await fs.readJson(bookingsFile).catch(() => []);
      socket.emit('sync-data', { orders, bookings });
    } catch (e) {
      // ignore
    }
  })();

  socket.on('disconnect', () => {
    console.log('Socket client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Love-Bite Server running on http://localhost:${PORT}`);
  // console.log(`Admin credentials: shreyas / shreyas123`);
});
