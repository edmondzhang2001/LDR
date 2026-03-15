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
    appleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      trim: true,
      default: null,
    },
    firstName: {
      type: String,
      trim: true,
      default: null,
    },
    lastName: {
      type: String,
      trim: true,
      default: null,
    },
    lastNameUpdatedAt: {
      type: Date,
      default: null,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isPremium: {
      type: Boolean,
      default: false,
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
    timezone: {
      type: String,
      default: 'UTC',
    },
    mood: {
      emoji: { type: String, default: null },
      text: { type: String, default: null },
    },
    pushToken: {
      type: String,
      default: null,
    },
    lastUpdatedDataAt: {
      type: Date,
      default: null,
    },
    reunion: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    photos: [
      {
        url: { type: String, required: true },
        thumbnailUrl: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        caption: { type: String, maxLength: [60, 'Captions can be max 60 characters.'], default: '' },
      },
    ],
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

userSchema.index({ pairingCode: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
