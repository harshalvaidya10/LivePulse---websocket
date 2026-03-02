import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { fetchFixtureEvents } from './src/providers/apiSports/events.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(`
  select m.id, m.provider_match_id
  from matches m
  left join commentary c on c.match_id = m.id
  where m.status in ('live','finished') and m.provider='api-sports'
  group by m.id
  having count(c.id)=0
  order by m.id desc
  limit 20
`);

for (const r of rows) {
  const events = await fetchFixtureEvents(r.provider_match_id);
  console.log(`match=${r.id} fixture=${r.provider_match_id} events=${events.length}`);
}
await pool.end();
