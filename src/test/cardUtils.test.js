import { describe, it, expect } from 'vitest';
import { buildFormatCardMap, mapCardData, selectRandomCards } from '../lib/cardUtils.js';

const makeCard = (id, formats, opts = {}) => ({
  id,
  name: `Card ${id}`,
  scryfall_uri: `https://scryfall.com/card/${id}`,
  formats,
  image_uris: { art_crop: 'art.jpg', border_crop: 'border.jpg' },
  layout: 'normal',
  ...opts,
});

describe('buildFormatCardMap', () => {
  it('groups cards by their legal formats', () => {
    const cards = [
      makeCard('a', ['Standard', 'Modern']),
      makeCard('b', ['Modern']),
      makeCard('c', ['Standard']),
    ];
    const map = buildFormatCardMap(cards);
    expect(map['Standard']).toHaveLength(2);
    expect(map['Modern']).toHaveLength(2);
    expect(map['Pauper']).toHaveLength(0);
  });

  it('produces an entry for every format even with no cards', () => {
    const map = buildFormatCardMap([]);
    expect(Object.keys(map)).toEqual(['Standard', 'Pauper', 'Pioneer', 'Modern', 'Legacy', 'Vintage']);
  });
});

describe('mapCardData', () => {
  it('maps a single-faced card to the Card shape', () => {
    const card = makeCard('a', ['Standard']);
    const result = mapCardData(card);
    expect(result).toEqual({
      id: 'a',
      image_uris: { art_crop: 'art.jpg', border_crop: 'border.jpg' },
      name: 'Card a',
      scryfall_uri: 'https://scryfall.com/card/a',
    });
  });

  it('uses the front face name and image for double-faced non-split cards', () => {
    const card = {
      id: 'b',
      name: 'Full Name',
      scryfall_uri: 'https://scryfall.com/card/b',
      formats: ['Modern'],
      layout: 'transform',
      card_faces: [
        { name: 'Front Face', image_uris: { art_crop: 'front.jpg', border_crop: 'front-b.jpg' } },
        { name: 'Back Face', image_uris: null },
      ],
    };
    const result = mapCardData(card);
    expect(result?.name).toBe('Front Face');
    expect(result?.image_uris).toEqual({ art_crop: 'front.jpg', border_crop: 'front-b.jpg' });
  });

  it('uses the full card name for split layout cards', () => {
    const card = {
      id: 'c',
      name: 'Fire // Ice',
      scryfall_uri: 'https://scryfall.com/card/c',
      formats: ['Legacy'],
      layout: 'split',
      image_uris: { art_crop: 'split.jpg', border_crop: 'split-b.jpg' },
      card_faces: [{ name: 'Fire' }, { name: 'Ice' }],
    };
    const result = mapCardData(card);
    expect(result?.name).toBe('Fire // Ice');
  });

  it('returns null for undefined input', () => {
    expect(mapCardData(undefined)).toBeNull();
  });
});

describe('selectRandomCards', () => {
  const pool = Array.from({ length: 10 }, (_, i) => makeCard(String(i), ['Standard']));

  it('returns exactly 4 cards', () => {
    const result = selectRandomCards(pool, new Set());
    expect(result).toHaveLength(4);
  });

  it('excludes previously correct cards when the remaining pool is large enough', () => {
    const alreadySeen = new Set(pool.slice(0, 6).map((c) => c.id));
    const result = selectRandomCards(pool, alreadySeen);
    expect(result.every((c) => !alreadySeen.has(c.id))).toBe(true);
  });

  it('falls back to the full pool when fewer than 4 unseen cards remain', () => {
    const alreadySeen = new Set(pool.slice(0, 8).map((c) => c.id));
    const result = selectRandomCards(pool, alreadySeen);
    expect(result).toHaveLength(4);
  });
});
