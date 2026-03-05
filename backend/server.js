require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRouter = require('./routes/auth');
const coupleRouter = require('./routes/couple');
const photoRouter = require('./routes/photo');
const reunionRouter = require('./routes/reunion');
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
