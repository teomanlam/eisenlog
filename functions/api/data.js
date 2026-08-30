const DEFAULT_EXERCISES = ["Kniebeuge", "Bankdrücken", "Kreuzheben", "Überkopfdrücken"];

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function getExercises(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'exercises'").first();
  return safeJsonParse(row?.value, DEFAULT_EXERCISES);
}

async function saveExercises(env, exercises) {
  const list = Array.isArray(exercises) && exercises.length ? exercises : DEFAULT_EXERCISES;
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('exercises', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(JSON.stringify(list)).run();
  return list;
}

async function readEntries(env) {
  const rows = await env.DB.prepare(
    "SELECT id, exercise, weight, sets, reps, date FROM entries ORDER BY date DESC"
  ).all();
  return rows.results ?? [];
}

async function saveEntries(env, entries) {
  if (!Array.isArray(entries)) {
    throw new Error('Invalid entries payload');
  }

  await env.DB.prepare("DELETE FROM entries").run();

  if (entries.length === 0) {
    return [];
  }

  const stmt = env.DB.prepare(
    "INSERT INTO entries (id, exercise, weight, sets, reps, date) VALUES (?, ?, ?, ?, ?, ?)"
  );

  for (const entry of entries) {
    await stmt.bind(
      entry.id,
      String(entry.exercise ?? ''),
      Number(entry.weight ?? 0),
      Number(entry.sets ?? 1),
      Number(entry.reps ?? 1),
      Number(entry.date ?? Date.now())
    ).run();
  }

  return entries;
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    if (request.method === 'GET') {
      const [entries, exercises] = await Promise.all([
        readEntries(env),
        getExercises(env)
      ]);

      return Response.json({ entries, exercises });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      if (!body || typeof body !== 'object') {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      if (body.type === 'entries') {
        const entries = await saveEntries(env, body.entries ?? []);
        return Response.json({ success: true, entries });
      }

      if (body.type === 'exercises') {
        const exercises = await saveExercises(env, body.exercises ?? DEFAULT_EXERCISES);
        return Response.json({ success: true, exercises });
      }

      return Response.json({ error: 'Unknown payload type' }, { status: 400 });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
