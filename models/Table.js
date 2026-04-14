const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: { type: Number, unique: true },
  status: { type: String, enum: ['free', 'booked'], default: 'free' }
});

module.exports = mongoose.model('Table', tableSchema);
