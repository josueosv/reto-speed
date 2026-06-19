import pg from 'pg';

const { Pool } = pg;

// Railway inyecta DATABASE_URL automáticamente cuando añades el plugin de PostgreSQL.
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  // Railway requiere SSL en producción. En local sin SSL.
  ssl: connectionString && connectionString.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

// Orden oficial de competencia.
export const TEAMS = [
  'GRAIAU', 'GEECO', 'GAD', 'DAI', 'OC', 'GITI', 'GCP', 'GRYGE',
  'GRF', 'GL', 'GI', 'GOF', 'GS', 'GEFPP', 'ONEC', 'GRIFI',
];

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      run_order INTEGER NOT NULL,
      time_ms INTEGER,                 -- tiempo en milisegundos; NULL = sin tiempo aún
      time_display TEXT,               -- formato original M:SS:CC para mostrar
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Estado del cronómetro (una sola fila, id=1).
  // running: si está corriendo. base_ms: tiempo acumulado al pausar.
  // started_epoch_ms: instante (epoch en ms del servidor) en que se inició/reanudó.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stopwatch (
      id INTEGER PRIMARY KEY DEFAULT 1,
      running BOOLEAN NOT NULL DEFAULT false,
      base_ms BIGINT NOT NULL DEFAULT 0,
      started_epoch_ms BIGINT,
      CONSTRAINT single_row CHECK (id = 1)
    );
  `);
  await pool.query(`
    INSERT INTO stopwatch (id, running, base_ms, started_epoch_ms)
    VALUES (1, false, 0, NULL)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Sembrar los 16 equipos si la tabla está vacía.
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM teams');
  if (rows[0].c === 0) {
    const values = TEAMS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
    const params = TEAMS.flatMap((name, i) => [name, i + 1]);
    await pool.query(
      `INSERT INTO teams (name, run_order) VALUES ${values}`,
      params
    );
    console.log('✓ 16 equipos sembrados en la base de datos.');
  }
}

// Convierte M:SS:CC (centésimas) a milisegundos. Ej: "4:55:67" -> 295670
export function parseTime(str) {
  const m = String(str).trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  const cent = parseInt(m[3], 10);
  if (sec > 59) return null;
  return ((min * 60 + sec) * 100 + cent) * 10; // a milisegundos
}

// Devuelve equipos ordenados: con tiempo (menor primero), luego sin tiempo (orden de carrera).
export async function getRanking() {
  const { rows } = await pool.query(`
    SELECT name, run_order, time_ms, time_display
    FROM teams
    ORDER BY
      (time_ms IS NULL) ASC,   -- los que tienen tiempo van primero
      time_ms ASC,             -- menor tiempo arriba
      run_order ASC            -- los sin tiempo en orden de carrera
  `);
  return rows.map((r, i) => ({
    position: i + 1,
    name: r.name,
    time: r.time_display,
    hasTime: r.time_ms !== null,
  }));
}

// --- Cronómetro sincronizado ---

// Devuelve el estado actual del cronómetro para que el cliente lo muestre.
export async function getStopwatch() {
  const { rows } = await pool.query(
    'SELECT running, base_ms, started_epoch_ms FROM stopwatch WHERE id = 1'
  );
  const r = rows[0];
  return {
    running: r.running,
    baseMs: Number(r.base_ms),
    startedEpochMs: r.started_epoch_ms !== null ? Number(r.started_epoch_ms) : null,
    serverNow: Date.now(), // para que el cliente corrija el desfase de reloj
  };
}

// Inicia o reanuda el cronómetro.
export async function startStopwatch() {
  await pool.query(
    'UPDATE stopwatch SET running = true, started_epoch_ms = $1 WHERE id = 1 AND running = false',
    [Date.now()]
  );
  return getStopwatch();
}

// Detiene el cronómetro y acumula el tiempo transcurrido en base_ms.
export async function stopStopwatch() {
  const { rows } = await pool.query(
    'SELECT running, base_ms, started_epoch_ms FROM stopwatch WHERE id = 1'
  );
  const r = rows[0];
  if (r.running) {
    const elapsed = Date.now() - Number(r.started_epoch_ms);
    const newBase = Number(r.base_ms) + elapsed;
    await pool.query(
      'UPDATE stopwatch SET running = false, base_ms = $1, started_epoch_ms = NULL WHERE id = 1',
      [newBase]
    );
  }
  return getStopwatch();
}

// Reinicia el cronómetro a cero.
export async function resetStopwatch() {
  await pool.query(
    'UPDATE stopwatch SET running = false, base_ms = 0, started_epoch_ms = NULL WHERE id = 1'
  );
  return getStopwatch();
}
