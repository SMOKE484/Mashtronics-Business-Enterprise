require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const cookieParser   = require('cookie-parser');
const connectDB      = require('./db');
const chatRouter        = require('./routes/chat');
const authRouter        = require('./routes/auth');
const packagesRouter    = require('./routes/packages');
const quotesRouter      = require('./routes/quotes');
const clientsRouter     = require('./routes/clients');
const techniciansRouter = require('./routes/technicians');
const responseOfficersRouter = require('./routes/responseOfficers');
const jobsRouter        = require('./routes/jobs');
const invoicesRouter    = require('./routes/invoices');
const maintenanceRouter = require('./routes/maintenance');
const complianceRouter  = require('./routes/compliance');
const dashboardRouter   = require('./routes/dashboard');
const camerasRouter     = require('./routes/cameras');
const appAuthRouter     = require('./routes/appAuth');
const appMeRouter       = require('./routes/appMe');
const appStaffMeRouter  = require('./routes/appStaffMe');
const appJobsRouter     = require('./routes/appJobs');
const appCamerasRouter  = require('./routes/appCameras');
const panicRouter       = require('./routes/panic');
const appPanicRouter    = require('./routes/appPanic');
const messagesRouter    = require('./routes/messages');
const messageThreadsRouter = require('./routes/messageThreads');
const appMessagesRouter = require('./routes/appMessages');
const eventsRouter      = require('./routes/events');

connectDB();

const app  = express();
const PORT = process.env.PORT || 3001;

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
app.use(express.json({ limit: '16kb' }));

app.use('/api/chat',        chatRouter);
app.use('/api/auth',        authRouter);
app.use('/api/packages',    packagesRouter);
app.use('/api/quotes',      quotesRouter);
app.use('/api/clients',     clientsRouter);
app.use('/api/technicians', techniciansRouter);
app.use('/api/response-officers', responseOfficersRouter);
app.use('/api/jobs',        jobsRouter);
app.use('/api/invoices',    invoicesRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/compliance',  complianceRouter);
app.use('/api/dashboard',   dashboardRouter);
app.use('/api/cameras',     camerasRouter);
app.use('/api/app/auth',    appAuthRouter);
app.use('/api/app/me',      appMeRouter);
app.use('/api/app/staff-me', appStaffMeRouter);
app.use('/api/app/jobs',    appJobsRouter);
app.use('/api/app/cameras', appCamerasRouter);
app.use('/api/panic',       panicRouter);
app.use('/api/app/panic',   appPanicRouter);
app.use('/api/messages/threads', messageThreadsRouter);
app.use('/api/messages',    messagesRouter);
app.use('/api/app/messages', appMessagesRouter);
app.use('/api/events',      eventsRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Mashtronics server running on :${PORT}`);
});
