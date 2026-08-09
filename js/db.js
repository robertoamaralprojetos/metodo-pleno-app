// Camada de acesso ao IndexedDB — Método Pleno
// Banco 100% local no dispositivo. Nenhum dado sai do navegador.

const DB_NAME = 'metodoPlenoDB';
const DB_VERSION = 4;

const STORES = {
  students: 'students',
  lessonPlans: 'lessonPlans',
  sessions: 'sessions',
  functionalEvaluations: 'functionalEvaluations',
  payments: 'payments',
  cancellations: 'cancellations',
  physicalEvaluations: 'physicalEvaluations',
  dailySessionMeta: 'dailySessionMeta',
  appSettings: 'appSettings',
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.students)) {
        const s = db.createObjectStore(STORES.students, { keyPath: 'id' });
        s.createIndex('byName', 'name', { unique: false });
        s.createIndex('byActive', 'active', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.lessonPlans)) {
        const s = db.createObjectStore(STORES.lessonPlans, { keyPath: 'id' });
        s.createIndex('byStudent', 'studentId', { unique: false });
        s.createIndex('byStudentDate', ['studentId', 'date'], { unique: false });
        s.createIndex('byDate', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const s = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
        s.createIndex('byStudent', 'studentId', { unique: false });
        s.createIndex('byStudentDate', ['studentId', 'date'], { unique: false });
        s.createIndex('byDate', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.functionalEvaluations)) {
        const s = db.createObjectStore(STORES.functionalEvaluations, { keyPath: 'id' });
        s.createIndex('byStudent', 'studentId', { unique: false });
        s.createIndex('byStudentDate', ['studentId', 'date'], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.payments)) {
        const s = db.createObjectStore(STORES.payments, { keyPath: 'id' });
        s.createIndex('byStudent', 'studentId', { unique: false });
        s.createIndex('byStudentDate', ['studentId', 'date'], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.cancellations)) {
        const s = db.createObjectStore(STORES.cancellations, { keyPath: 'id' });
        s.createIndex('byStudent', 'studentId', { unique: false });
        s.createIndex('byStudentDate', ['studentId', 'date'], { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.physicalEvaluations)) {
        const s = db.createObjectStore(STORES.physicalEvaluations, { keyPath: 'id' });
        s.createIndex('byStudent', 'studentId', { unique: false });
        s.createIndex('byStudentDate', ['studentId', 'date'], { unique: false });
      }

      // Uma "ficha do dia" por aluno+data (id determinístico: studentId__data), guardando
      // o modo de Borg escolhido naquele dia (por exercício ou treino geral) e a nota geral.
      if (!db.objectStoreNames.contains(STORES.dailySessionMeta)) {
        const s = db.createObjectStore(STORES.dailySessionMeta, { keyPath: 'id' });
        s.createIndex('byStudent', 'studentId', { unique: false });
      }

      // Configurações globais do app (não por aluno) — regras de desmarcação, nome do
      // profissional no cabeçalho, etc. Registro único, id fixo 'global'.
      if (!db.objectStoreNames.contains(STORES.appSettings)) {
        db.createObjectStore(STORES.appSettings, { keyPath: 'id' });
      }
    };

    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  STORES,

  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    await promisifyRequest(store.put(value));
    return value;
  },

  async get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return promisifyRequest(store.get(key));
  },

  async delete(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return promisifyRequest(store.delete(key));
  },

  async getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return promisifyRequest(store.getAll());
  },

  async getAllByIndex(storeName, indexName, query) {
    const store = await tx(storeName, 'readonly');
    const index = store.index(indexName);
    return promisifyRequest(index.getAll(query));
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return promisifyRequest(store.clear());
  },

  async exportAll() {
    const data = { version: DB_VERSION, exportedAt: new Date().toISOString() };
    for (const key of Object.values(STORES)) {
      data[key] = await this.getAll(key);
    }
    return data;
  },

  async importAll(data) {
    for (const key of Object.values(STORES)) {
      if (!Array.isArray(data[key])) continue;
      await this.clear(key);
      const store = await tx(key, 'readwrite');
      for (const item of data[key]) {
        store.put(item);
      }
    }
  },
};

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

window.DB = DB;
window.dbUuid = uuid;
