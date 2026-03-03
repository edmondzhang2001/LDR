const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    oauthProvider: {
      type: String,
      enum: ['apple', 'google'],
      required: true,
    },
    oauthId: {
      type: String,
      required: true,
      unique: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    location: {
      city: { type: String, default: null },
      coords: {
        type: {
          type: String,
          enum: ['Point'],
          default: null,
        },
        coordinates: {
          type: [Number],
          default: null,
        },
      },
    },
    pushToken: {
      type: String,
      default: null,
    },
    lastUpdatedDataAt: {
      type: Date,
      default: null,
    },
    pairingCode: {
      type: String,
      default: null,
      select: false,
    },
    pairingCodeExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.index({ oauthId: 1 }, { unique: true });
userSchema.index({ pairingCode: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
