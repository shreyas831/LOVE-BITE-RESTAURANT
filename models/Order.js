const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  tableNumber: Number,
  items: [{ name: String, qty: Number, price: Number }],
  totalAmount: Number,
  orderedBy: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
