require('dotenv').config();

// So you can confirm the backend sees GOOGLE_CLIENT_ID when you start the server
console.log('Google Sign-In configured:', !!process.env.GOOGLE_CLIENT_ID);
console.log('Apple Sign-In configured:', !!process.env.APPLE_CLIENT_ID);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRouter = require('./routes/auth');
const coupleRouter = require('./routes/couple');
const photoRouter = require('./routes/photo');
const reunionRouter = require('./routes/reunion');
const revenuecatRouter = require('./routes/revenuecat');
const uploadRouter = require('./routes/upload');
const userRouter = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/couple', coupleRouter);
app.use('/api/photo', photoRouter);
app.use('/api/reunion', reunionRouter);
app.use('/api/user', userRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/webhooks', revenuecatRouter);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ldr')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
