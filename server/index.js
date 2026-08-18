require('dotenv').config();
const path           = require('path');
const express        = require('express');
const cors           = require('cors');
const cookieParser   = require('cookie-parser');
const connectDB      = require('./db');
const chatRouter              = require('./routes/chat');
const authRouter              = require('./routes/auth');
const packagesRouter          = require('./routes/packages');
const quotesRouter            = require('./routes/quotes');
// Mounted alongside the Dahua callback work so its own admin UI (pending
// device binds, dashboard banner) is actually testable end-to-end. The rest
// of the SecureWatch backend (technicians, jobs, invoices, messaging, etc.)
// stays deliberately unmounted per the 2026-07-15 hotfix — that's still a
// separate, reviewed-commit decision, not something this change makes.
const dashboardRouter         = require('./routes/dashboard');
const clientsRouter           = require('./routes/clients');
const camerasRouter           = require('./routes/cameras');
const dahuaCallbackRouter     = require('./routes/dahuaCallback');
const dahuaPendingBindsRouter = require('./routes/dahuaPendingBinds');

connectDB();

const app  = express();
const PORT = process.env.PORT || 3001;

// Mounted BEFORE cors() deliberately: the player page's ES module imports
// fetch in CORS mode and send an Origin header even for same-origin
// requests, and this server's own origin was never in allowedOrigins below
// (only the client/admin dev origins are) — routing it through the CORS
// check turned every module/WASM asset request into a 500 (found live
// 2026-08-04 verifying the mobile player page, see BUGS_AND_FIXES.md).
// These are public, non-sensitive static assets (SDK JS/WASM) meant to load
// from anywhere a WebView or browser points at them, so skipping the CORS
// gate entirely for this path is correct, not just a workaround.
app.use(express.static(path.join(__dirname, 'public')));

const allowedOrigins = [
  ...(process.env.CLIENT_ORIGIN || 'http://localhost:5174').split(',').map(o => o.trim()),
  ...(process.env.ADMIN_ORIGIN  || 'http://localhost:5175').split(',').map(o => o.trim()),
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
// `verify` stashes the pre-parse raw body on every request — needed by the
// Dahua callback route, whose `id`/`companyId` fields are 19-digit integers
// that JSON.parse silently corrupts (exceed Number.MAX_SAFE_INTEGER). Cheap
// to apply globally since the 16kb cap already bounds the cost.
app.use(express.json({ limit: '16kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.use('/api/chat',                 chatRouter);
app.use('/api/auth',                 authRouter);
app.use('/api/packages',             packagesRouter);
app.use('/api/quotes',               quotesRouter);
app.use('/api/dashboard',            dashboardRouter);
app.use('/api/clients',              clientsRouter);
app.use('/api/cameras',              camerasRouter);
app.use('/api/dahua/callback',       dahuaCallbackRouter);
app.use('/api/dahua-pending-binds',  dahuaPendingBindsRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Mashtronics server running on :${PORT}`);
});
