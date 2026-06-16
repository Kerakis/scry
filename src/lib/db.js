import { openDB } from 'idb';

/** @type {Awaited<ReturnType<typeof openDB>> | undefined} */
let db;

async function getDB() {
  if (!db) {
    db = await openDB('mtg-cache', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('formats')) {
          db.createObjectStore('formats');
        }
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards');
        }
      },
    });
  }
  return db;
}

/** @param {any[]} allCards */
export async function cacheCards(allCards) {
  const database = await getDB();
  const tx = database.transaction(['cards'], 'readwrite');
  const store = tx.objectStore('cards');
  for (const card of allCards) {
    await store.put(card, card.id);
  }
}
