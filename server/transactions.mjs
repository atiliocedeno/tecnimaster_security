export async function transaction(db, fn) {
  if (typeof db.transaction === 'function') return db.transaction(fn);
  const conn = await db.connect();
  try { await conn.query('BEGIN'); const result=await fn(conn); await conn.query('COMMIT'); return result; }
  catch(e) {await conn.query('ROLLBACK');throw e;}
  finally {conn.release();}
}
