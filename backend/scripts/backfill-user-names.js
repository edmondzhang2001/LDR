require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

function splitFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ldr';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

  const users = await User.find({
    $or: [{ firstName: null }, { firstName: { $exists: false } }],
  }).select('_id name firstName lastName');

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const hasFirst = typeof user.firstName === 'string' && user.firstName.trim();
    if (hasFirst) {
      skipped += 1;
      continue;
    }

    const parsed = splitFullName(user.name);
    if (!parsed.firstName) {
      skipped += 1;
      continue;
    }

    user.firstName = parsed.firstName;
    user.lastName = parsed.lastName || null;
    user.name = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ');
    await user.save();
    updated += 1;
  }

  console.log(`[backfill-user-names] scanned=${users.length} updated=${updated} skipped=${skipped}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('[backfill-user-names] failed:', err?.message || err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
