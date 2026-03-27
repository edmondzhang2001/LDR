const mongoose = require('mongoose');

const ONBOARDING_EVENT_NAMES = [
  'onboarding_started',
  'slide_viewed',
  'slide_advanced',
  'slide_back',
  'onboarding_exited',
  'onboarding_completed',
];

const timelineEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, trim: true },
    eventName: { type: String, enum: ONBOARDING_EVENT_NAMES, required: true },
    slideIndex: { type: Number, default: null },
    slideKey: { type: String, default: null, trim: true },
    timeOnSlideMs: { type: Number, min: 0, default: null },
    occurredAt: { type: Date, required: true, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const onboardingSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    appVersion: { type: String, default: null, trim: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    exitedAt: { type: Date, default: null },
    lastSlideIndex: { type: Number, default: null },
    lastSlideTitle: { type: String, default: null, trim: true },
    exitedSlideTitle: { type: String, default: null, trim: true },
    subscriptionConverted: { type: Boolean, default: false },
    subscriptionCheckedAt: { type: Date, default: null },
    paymentOption: { type: String, default: null, trim: true },
    subscriptionSource: { type: String, default: null, trim: true },
    paywallResult: { type: String, default: null, trim: true },
    timeline: { type: [timelineEventSchema], default: [] },
  },
  { timestamps: true }
);

onboardingSessionSchema.index({ userId: 1, createdAt: 1 });
onboardingSessionSchema.index({ createdAt: 1 });

module.exports = mongoose.model('OnboardingSession', onboardingSessionSchema);
module.exports.ONBOARDING_EVENT_NAMES = ONBOARDING_EVENT_NAMES;
