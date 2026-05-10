import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import morgan from 'morgan';

import { pool } from './db/pool.js';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';

import { attachWebSocket } from './sockets/wsServer.js';

const app = express();

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') || '*',
    credentials: true
  })
);

app.use(express.json());
app.use(morgan('dev'));

/*
|--------------------------------------------------------------------------
| Root Route
|--------------------------------------------------------------------------
*/

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'EcoGrid backend is running'
  });
});

/*
|--------------------------------------------------------------------------
| Health Check Route
|--------------------------------------------------------------------------
*/

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      ok: true,
      database: 'connected'
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((_req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, _req, res, _next) => {
  console.error('[err]', err);

  res.status(500).json({
    error: err?.message || 'internal error'
  });
});

/*
|--------------------------------------------------------------------------
| Server
|--------------------------------------------------------------------------
*/

const PORT = Number(process.env.PORT || 4000);

const server = http.createServer(app);

attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`\n⚡ EcoGrid backend ready`);
  console.log(`   HTTP : http://localhost:${PORT}`);
  console.log(`   WS   : ws://localhost:${PORT}/ws\n`);
});

/*
|--------------------------------------------------------------------------
| Process Guards
|--------------------------------------------------------------------------
*/

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});