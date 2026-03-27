const mongoose = require('mongoose');

const onboardingSurveyResponseSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    questionKey: { type: String, required: true, trim: true },
    selectedOptions: { type: [String], default: [] },
    partnerNameInput: { type: String, default: null, trim: true },
    answeredAt: { type: Date, required: true, default: Date.now },
    appVersion: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

onboardingSurveyResponseSchema.index({ sessionId: 1, questionKey: 1 }, { unique: true });
onboardingSurveyResponseSchema.index({ userId: 1, questionKey: 1, updatedAt: -1 });

module.exports = mongoose.model('OnboardingSurveyResponse', onboardingSurveyResponseSchema);
