require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const cookieParser   = require('cookie-parser');
const connectDB      = require('./db');
const chatRouter     = require('./routes/chat');
const authRouter     = require('./routes/auth');
const packagesRouter = require('./routes/packages');
const quotesRouter   = require('./routes/quotes');

connectDB();

const app  = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5174',
  process.env.ADMIN_ORIGIN  || 'http://localhost:5175',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));

app.use('/api/chat',     chatRouter);
app.use('/api/auth',     authRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/quotes',   quotesRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Mashtronics server running on :${PORT}`);
});
