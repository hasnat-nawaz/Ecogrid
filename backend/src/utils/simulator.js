// Smart meter telemetry simulator. Run separately:  npm run simulate
import 'dotenv/config';
import { query, pool } from '../db/pool.js';

const TICK_MS = Number(process.env.SIM_TICK_MS || 2000);

async function main() {
  const { rows: meters } = await query(`SELECT meter_id FROM smart_meters WHERE status='active'`);
  if (!meters.length) {
    console.log('[sim] no active meters; seed the DB first.');
    process.exit(0);
  }
  console.log(`[sim] streaming readings for ${meters.length} meters every ${TICK_MS}ms`);

  setInterval(async () => {
    for (const m of meters) {
      const hour = new Date().getHours();
      const base = hour >= 17 && hour < 22 ? 2.5 : hour >= 6 && hour < 17 ? 1.2 : 0.5;
      const energy = +(base + Math.random() * 1.5).toFixed(3);
      const voltage = +(220 + (Math.random() - 0.5) * 10).toFixed(2);
      const current = +(energy * 5 + Math.random()).toFixed(2);
      // ~5% chance of a spike to exercise alerts
      const spike = Math.random() < 0.05 ? energy + 6 : energy;
      try {
        await query(
          `INSERT INTO readings (meter_id, energy_consumed, voltage, current_amp) VALUES ($1,$2,$3,$4)`,
          [m.meter_id, spike, voltage, current]
        );
      } catch (e) { console.error('[sim] insert failed', e.message); }
    }
  }, TICK_MS);
}

main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
