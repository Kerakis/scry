import { FORMATS } from './constants.js';

/**
 * @typedef {{ id: string, image_uris?: Record<string, string>, name: string, scryfall_uri: string }} Card
 */

/**
 * @param {T[]} array
 * @returns {T[]}
 * @template T
 */
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** @param {any[]} allCards */
export function buildFormatCardMap(allCards) {
  /** @type {Record<string, any[]>} */
  const map = {};
  for (const format of FORMATS) {
    map[format] = allCards.filter((card) => card.formats.includes(format));
  }
  return map;
}

/** @param {any} card */
export function mapCardData(card) {
  if (!card) {
    console.error('Card is undefined');
    return null;
  }
  const useFaceName = card.card_faces && card.layout !== 'split';
  return {
    id: card.id,
    image_uris: card.image_uris ?? card.card_faces?.[0]?.image_uris,
    name: useFaceName ? card.card_faces[0].name : card.name,
    scryfall_uri: card.scryfall_uri,
  };
}

/**
 * @param {any[]} formatCards
 * @param {Set<string>} previouslyCorrect
 */
export function selectRandomCards(formatCards, previouslyCorrect) {
  const available = formatCards.filter((card) => !previouslyCorrect.has(card.id));
  if (available.length < 4) {
    return shuffle(formatCards).slice(0, 4);
  }
  return shuffle(available).slice(0, 4);
}
