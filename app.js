const DEFAULT_EXERCISES = ["Kniebeuge", "Bankdrücken", "Kreuzheben", "Überkopfdrücken"];
let entries = [];
let exercises = [...DEFAULT_EXERCISES];
let openCards = new Set();
let db = null;
let apiBase = '';
let usingFirebase = false;
let usingCloudflare = false;

function resolveFirebaseConfig() {
  return window.FIREBASE_CONFIG || {};
}

function resolveCloudflareConfig() {
  return window.CLOUDFLARE_CONFIG || {};
}

function hasFirebaseConfig() {
  const config = resolveFirebaseConfig();
  return Boolean(config.apiKey && config.projectId && !config.apiKey.includes('YOUR_'));
}

function hasCloudflareConfig() {
  const config = resolveCloudflareConfig();
  return Boolean(config.apiBase || config.baseUrl || config.url);
}

function initStorage() {
  if (hasCloudflareConfig()) {
    apiBase = resolveCloudflareConfig().apiBase || resolveCloudflareConfig().baseUrl || '/api/data';
    usingCloudflare = true;
    console.info('Cloudflare API aktiv.');
    return;
  }

  if (hasFirebaseConfig()) {
    initFirebase();
  } else {
    console.info('Keine Cloudflare- oder Firebase-Konfiguration gefunden. Fallback auf LocalStorage aktiv.');
  }
}

function initFirebase() {
  const config = resolveFirebaseConfig();

  if (!hasFirebaseConfig()) {
    console.info('Firebase-Konfiguration fehlt. Fallback auf LocalStorage aktiv.');
    return;
  }

  try {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
    db = firebase.firestore(app);
    usingFirebase = true;
    console.info('Firebase verbunden.');
  } catch (error) {
    console.error('Firebase-Initialisierung fehlgeschlagen:', error);
    usingFirebase = false;
  }
}

async function loadData() {
  if (usingCloudflare) {
    await loadCloudflareData();
  } else if (usingFirebase) {
    await loadFirebaseData();
  } else {
    await loadLocalData();
  }

  renderExSelect();
  renderExerciseManager();
  renderList();
}

async function loadCloudflareData() {
  try {
    const response = await fetch(apiBase, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Cloudflare API Fehler: ${response.status}`);
    }

    const payload = await response.json();
    entries = Array.isArray(payload.entries) ? payload.entries : [];
    exercises = Array.isArray(payload.exercises) ? payload.exercises : [...DEFAULT_EXERCISES];
  } catch (error) {
    console.error('Laden aus Cloudflare fehlgeschlagen:', error);
    entries = [];
    exercises = [...DEFAULT_EXERCISES];
  }

  entries.forEach((entry) => {
    if (!exercises.includes(entry.exercise)) {
      exercises.push(entry.exercise);
    }
  });
}

async function loadLocalData() {
  try {
    const raw = localStorage.getItem('eisenlog-entries');
    entries = raw ? JSON.parse(raw) : [];
  } catch (error) {
    entries = [];
  }

  try {
    const rawExercises = localStorage.getItem('eisenlog-exercises');
    exercises = rawExercises ? JSON.parse(rawExercises) : [...DEFAULT_EXERCISES];
  } catch (error) {
    exercises = [...DEFAULT_EXERCISES];
  }

  entries.forEach((entry) => {
    if (!exercises.includes(entry.exercise)) {
      exercises.push(entry.exercise);
    }
  });
}

async function loadFirebaseData() {
  try {
    const entriesSnapshot = await db.collection('entries').orderBy('date', 'desc').get();
    entries = entriesSnapshot.docs.map((doc) => doc.data());

    const settingsDoc = await db.collection('settings').doc('main').get();
    if (settingsDoc.exists && Array.isArray(settingsDoc.data().exercises)) {
      exercises = settingsDoc.data().exercises;
    } else {
      exercises = [...DEFAULT_EXERCISES];
    }
  } catch (error) {
    console.error('Laden aus Firebase fehlgeschlagen:', error);
    entries = [];
    exercises = [...DEFAULT_EXERCISES];
  }

  entries.forEach((entry) => {
    if (!exercises.includes(entry.exercise)) {
      exercises.push(entry.exercise);
    }
  });
}

function saveDataLocal() {
  localStorage.setItem('eisenlog-entries', JSON.stringify(entries));
  localStorage.setItem('eisenlog-exercises', JSON.stringify(exercises));
}

async function saveEntries() {
  if (usingCloudflare) {
    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'entries', entries })
      });

      if (!response.ok) {
        throw new Error(`Cloudflare API Fehler: ${response.status}`);
      }

      return;
    } catch (error) {
      console.error('Speichern in Cloudflare fehlgeschlagen:', error);
    }
  }

  if (usingFirebase && db) {
    try {
      const batch = db.batch();
      entries.forEach((entry) => {
        batch.set(db.collection('entries').doc(entry.id), entry);
      });
      await batch.commit();
      return;
    } catch (error) {
      console.error('Speichern in Firebase fehlgeschlagen:', error);
    }
  }

  saveDataLocal();
}

async function saveExercises() {
  if (usingCloudflare) {
    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'exercises', exercises })
      });

      if (!response.ok) {
        throw new Error(`Cloudflare API Fehler: ${response.status}`);
      }

      return;
    } catch (error) {
      console.error('Übungen in Cloudflare speichern fehlgeschlagen:', error);
    }
  }

  if (usingFirebase && db) {
    try {
      await db.collection('settings').doc('main').set({ exercises }, { merge: true });
      return;
    } catch (error) {
      console.error('Übungen in Firebase speichern fehlgeschlagen:', error);
    }
  }

  saveDataLocal();
}

function normalizeExerciseName(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function addExerciseName(exerciseInput) {
  const name = normalizeExerciseName(exerciseInput || '');
  if (!name) return null;

  const existing = exercises.find((exercise) => exercise.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  exercises.push(name);
  renderExSelect();
  renderExerciseManager();
  saveExercises();
  return name;
}

function removeExerciseName(exerciseName) {
  const name = normalizeExerciseName(exerciseName || '');
  if (!name) return;

  exercises = exercises.filter((exercise) => exercise.toLowerCase() !== name.toLowerCase());
  entries = entries.filter((entry) => entry.exercise.toLowerCase() !== name.toLowerCase());

  saveExercises();
  saveEntries();
  renderExSelect();
  renderExerciseManager();
  renderList();
}

function renderExSelect() {
  const sel = document.getElementById('exSelect');
  if (!sel) return;
  sel.innerHTML = '';

  if (!exercises.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Keine Übungen angelegt';
    sel.appendChild(opt);
    return;
  }

  exercises.forEach((exercise) => {
    const opt = document.createElement('option');
    opt.value = exercise;
    opt.textContent = exercise;
    sel.appendChild(opt);
  });
}

function renderExerciseManager() {
  const list = document.getElementById('exerciseList');
  if (!list) return;

  list.innerHTML = '';

  if (!exercises.length) {
    list.innerHTML = '<div class="empty" style="padding:10px 0;">Keine Übungen angelegt.</div>';
    return;
  }

  exercises.forEach((exercise) => {
    const item = document.createElement('div');
    item.className = 'exercise-pill';
    item.innerHTML = `
      <span>${exercise}</span>
      <button type="button" data-remove-exercise="${exercise}" aria-label="Übung löschen">✕</button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-remove-exercise]').forEach((button) => {
    button.addEventListener('click', () => {
      removeExerciseName(button.dataset.removeExercise);
    });
  });
}

function pbFor(exercise) {
  const list = entries.filter((entry) => entry.exercise === exercise);
  if (!list.length) return null;
  return list.reduce((best, entry) => (entry.weight > best.weight ? entry : best), list[0]);
}

function setVolume(entry) {
  return entry.weight * entry.reps * entry.sets;
}

function totalVolume(exercise) {
  return entries
    .filter((entry) => entry.exercise === exercise)
    .reduce((sum, entry) => sum + setVolume(entry), 0);
}

function fmtVol(value) {
  return Math.round(value).toLocaleString('de-DE');
}

function dayKey(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 10);
}

function renderList() {
  const container = document.getElementById('exList');
  if (!container) return;
  container.innerHTML = '';

  const usedExercises = exercises.filter((exercise) => entries.some((entry) => entry.exercise === exercise));

  if (!usedExercises.length) {
    container.innerHTML = '<div class="empty">Noch keine Einträge. Trag deinen ersten Satz oben ein.</div>';
    return;
  }

  usedExercises.forEach((exercise) => {
    const list = entries.filter((entry) => entry.exercise === exercise).sort((a, b) => b.date - a.date);
    const pb = pbFor(exercise);
    const volume = totalVolume(exercise);
    const card = document.createElement('div');
    card.className = 'ex-card';

    const groups = {};
    list.forEach((entry) => {
      const key = dayKey(entry.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    const dayKeys = Object.keys(groups).sort().reverse();
    const isOpen = openCards.has(exercise);

    card.innerHTML = `
      <div class="ex-head" data-ex="${exercise}">
        <div>
          <div class="ex-name">${exercise}</div>
          <div class="ex-sub" style="padding:0;margin-top:2px;">${list.length} ${list.length === 1 ? 'Satz' : 'Sätze'} gesamt</div>
        </div>
        <div class="ex-pb">
          <div class="pb-val">${pb.weight}<span class="unit">kg × ${pb.reps}</span></div>
          <div class="vol-val">Σ ${fmtVol(volume)} kg Volumen</div>
        </div>
      </div>
      <div class="history ${isOpen ? 'open' : ''}">
        ${dayKeys.map((key) => {
          const dayEntries = groups[key].sort((a, b) => a.date - b.date);
          const sessionVol = dayEntries.reduce((sum, entry) => sum + setVolume(entry), 0);
          return `
            <div class="sess-group">
              <div class="sess-head"><span>${formatDate(dayEntries[0].date)}</span><span>Vol: ${fmtVol(sessionVol)} kg</span></div>
              ${dayEntries.map((entry) => `
                <div class="hist-row ${entry.id === pb.id ? 'is-pb' : ''}">
                  <span>${entry.sets}×${entry.reps} @ ${entry.weight}kg ${entry.id === pb.id ? '★' : ''}</span>
                  <span class="del" data-del="${entry.id}">✕</span>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll('.ex-head').forEach((header) => {
    header.addEventListener('click', () => {
      const exercise = header.dataset.ex;
      if (openCards.has(exercise)) {
        openCards.delete(exercise);
      } else {
        openCards.add(exercise);
      }
      renderList();
    });
  });

  container.querySelectorAll('.del').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = button.dataset.del;

      if (usingFirebase && db) {
        await db.collection('entries').doc(id).delete();
      }

      entries = entries.filter((entry) => entry.id !== id);
      await saveEntries();
      renderList();
    });
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const addExerciseBtn = document.getElementById('addExerciseBtn');
if (addExerciseBtn) {
  addExerciseBtn.addEventListener('click', async () => {
    const input = document.getElementById('exerciseNameInput');
    const value = normalizeExerciseName(input.value);
    if (!value) {
      input.focus();
      return;
    }

    const newExercise = addExerciseName(value);
    if (!newExercise) {
      input.focus();
      return;
    }

    const exSelect = document.getElementById('exSelect');
    if (exSelect) exSelect.value = newExercise;
    input.value = '';
  });
}

const exerciseNameInput = document.getElementById('exerciseNameInput');
if (exerciseNameInput) {
  exerciseNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (addExerciseBtn) addExerciseBtn.click();
    }
  });
}

const addBtn = document.getElementById('addBtn');
if (addBtn) {
  addBtn.addEventListener('click', async () => {
    const exercise = document.getElementById('exSelect').value;

    const weight = parseFloat(document.getElementById('weightInput').value);
    const sets = parseInt(document.getElementById('setsInput').value) || 1;
    const reps = parseInt(document.getElementById('repsInput').value) || 1;

    if (!exercise || !weight || weight <= 0) {
      if (!exercise) {
        document.getElementById('exSelect').focus();
      } else {
        document.getElementById('weightInput').focus();
      }
      return;
    }

    const previousPb = pbFor(exercise);
    const isNewPb = !previousPb || weight > previousPb.weight;

    const entry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      exercise,
      weight,
      sets,
      reps,
      date: Date.now()
    };

    entries.push(entry);

    if (usingFirebase && db) {
      try {
        await db.collection('entries').doc(entry.id).set(entry);
      } catch (error) {
        console.error('Eintrag in Firebase speichern fehlgeschlagen:', error);
      }
    }

    await saveEntries();
    document.getElementById('weightInput').value = '';
    openCards.add(exercise);
    renderList();

    if (isNewPb) {
      const flash = document.getElementById('pbFlash');
      flash.textContent = `🏆 Neuer PB — ${exercise}: ${weight}kg × ${reps}`;
      flash.style.display = 'block';
      setTimeout(() => {
        flash.style.display = 'none';
      }, 3000);
    }
  });
}

const pageHasLogForm = !!document.getElementById('addBtn');
const pageHasExerciseManager = !!document.getElementById('exerciseNameInput');

if (pageHasLogForm || pageHasExerciseManager) {
  initStorage();
  loadData();
}
