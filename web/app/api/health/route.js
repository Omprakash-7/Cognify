import { query } from '../../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await query('SELECT now() AS db_time');
    return Response.json({ ok: true, dbTime: rows[0].db_time });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
