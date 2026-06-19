import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initDb, getRanking, parseTime, TEAMS,
         getStopwatch, startStopwatch, stopStopwatch, resetStopwatch } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// PIN para el panel de control y el borrado. Configúralo en Railway como ADMIN_PIN.
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API pública (proyección) ---

// Ranking completo, ordenado.
app.get('/api/ranking', async (req, res) => {
  try {
    const ranking = await getRanking();
    res.json(ranking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener ranking' });
  }
});

// Estado del cronómetro (público, para la proyección).
app.get('/api/stopwatch', async (req, res) => {
  try {
    res.json(await getStopwatch());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer cronómetro' });
  }
});

// --- Middleware de PIN para acciones de admin ---
function checkPin(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.body.pin;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }
  next();
}

// Verificar PIN (para login del panel).
app.post('/api/verify-pin', (req, res) => {
  if (req.body.pin === ADMIN_PIN) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'PIN incorrecto' });
  }
});

// Lista de equipos en orden de carrera (para el selector del panel).
app.get('/api/teams', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, run_order, time_display FROM teams ORDER BY run_order ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener equipos' });
  }
});

// Registrar / actualizar el tiempo de un equipo.
app.post('/api/time', checkPin, async (req, res) => {
  const { team, time } = req.body;
  if (!team || !TEAMS.includes(team)) {
    return res.status(400).json({ error: 'Equipo inválido' });
  }
  const ms = parseTime(time);
  if (ms === null) {
    return res.status(400).json({ error: 'Formato de tiempo inválido. Usa M:SS:CC (ej. 4:55:67)' });
  }
  try {
    await pool.query(
      'UPDATE teams SET time_ms = $1, time_display = $2, updated_at = now() WHERE name = $3',
      [ms, time.trim(), team]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el tiempo' });
  }
});

// Borrar el tiempo de un solo equipo.
app.post('/api/clear-team', checkPin, async (req, res) => {
  const { team } = req.body;
  if (!team || !TEAMS.includes(team)) {
    return res.status(400).json({ error: 'Equipo inválido' });
  }
  try {
    await pool.query(
      'UPDATE teams SET time_ms = NULL, time_display = NULL, updated_at = now() WHERE name = $1',
      [team]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al borrar' });
  }
});

// RESET total: borra todos los tiempos y vuelve al orden de carrera.
app.post('/api/reset', checkPin, async (req, res) => {
  try {
    await pool.query('UPDATE teams SET time_ms = NULL, time_display = NULL, updated_at = now()');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reiniciar' });
  }
});

// --- Control del cronómetro (protegido) ---
app.post('/api/stopwatch/start', checkPin, async (req, res) => {
  try { res.json(await startStopwatch()); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});
app.post('/api/stopwatch/stop', checkPin, async (req, res) => {
  try { res.json(await stopStopwatch()); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});
app.post('/api/stopwatch/reset', checkPin, async (req, res) => {
  try { res.json(await resetStopwatch()); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Error' }); }
});

// --- Rutas de páginas ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/control', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'control.html'));
});

// Arranque.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Reto Speed corriendo en http://localhost:${PORT}`);
      console.log(`  Proyección: /`);
      console.log(`  Control:    /control`);
    });
  })
  .catch((err) => {
    console.error('Error iniciando la base de datos:', err);
    process.exit(1);
  });
