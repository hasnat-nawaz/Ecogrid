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
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

app.use((err, _req, res, _next) => {
  console.error('[err]', err);
  res.status(500).json({ error: 'internal error' });
});

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`\n⚡ EcoGrid backend ready`);
  console.log(`   HTTP : http://localhost:${PORT}`);
  console.log(`   WS   : ws://localhost:${PORT}/ws\n`);
});
