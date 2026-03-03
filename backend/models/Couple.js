const mongoose = require('mongoose');

const coupleSchema = new mongoose.Schema(
  {
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pairedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

coupleSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.model('Couple', coupleSchema);
