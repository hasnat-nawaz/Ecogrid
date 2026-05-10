import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { signToken, authRequired } from '../middleware/auth.js';

const r = Router();

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

r.post('/register', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const { email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `INSERT INTO app_users (email, password_hash, role) VALUES ($1,$2,'user') RETURNING user_id, email, role`,
      [email, hash]
    );
    const user = rows[0];
    await query(
      `INSERT INTO consumers (user_id, name, email) VALUES ($1, $2, $1::text || '')
       ON CONFLICT (email) DO NOTHING`,
      [user.user_id, email.split('@')[0]]
    );
    const token = signToken({ uid: user.user_id, role: user.role, email: user.email });
    res.json({ token, user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email already registered' });
    console.error(e); res.status(500).json({ error: 'server error' });
  }
});

r.post('/login', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid input' });
  const { email, password } = parsed.data;
  const { rows } = await query(`SELECT user_id, email, role, password_hash FROM app_users WHERE email=$1`, [email]);
  const u = rows[0];
  if (!u) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = signToken({ uid: u.user_id, role: u.role, email: u.email });
  res.json({ token, user: { user_id: u.user_id, email: u.email, role: u.role } });
});

r.get('/me', authRequired, async (req, res) => {
  res.json({ user: req.user });
});

export default r;
