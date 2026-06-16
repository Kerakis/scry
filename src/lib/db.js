import { openDB } from 'idb';

let db;

async function getDB() {
  if (!db) {
    db = await openDB('mtg-cache', 3, {
      upgrade(database) {
        for (const name of [...database.objectStoreNames]) {
          database.deleteObjectStore(name);
        }
        database.createObjectStore('data');
      },
    });
  }
  return db;
}

export async function getCachedCardData() {
  const database = await getDB();
  return database.get('data', 'cards');
}

/** @param {{ cards: any[], formatCounts: Record<string, number>, bulkDataUpdated: string }} cardData */
export async function setCachedCardData(cardData) {
  const database = await getDB();
  await database.put('data', cardData, 'cards');
}
