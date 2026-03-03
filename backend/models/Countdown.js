const mongoose = require('mongoose');

const countdownSchema = new mongoose.Schema(
  {
    coupleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Couple',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    reunionDate: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

countdownSchema.index({ coupleId: 1 });

module.exports = mongoose.model('Countdown', countdownSchema);
