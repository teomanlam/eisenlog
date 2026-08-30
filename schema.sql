CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  exercise TEXT NOT NULL,
  weight REAL NOT NULL,
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  date INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value)
VALUES ('exercises', '["Kniebeuge","Bankdrücken","Kreuzheben","Überkopfdrücken"]')
ON CONFLICT(key) DO NOTHING;
