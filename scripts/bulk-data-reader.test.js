// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { readCardObjects } from './bulk-data-reader.js';

const cards = [
  { id: '1', name: 'Llanowar Elves' },
  { id: '2', name: 'Counterspell' },
];
const jsonl = cards.map((c) => JSON.stringify(c)).join('\n') + '\n';

const tmpFiles = [];
function tmpFile(suffix) {
  const file = path.join(os.tmpdir(), `bulk-data-reader-${Date.now()}-${suffix}`);
  tmpFiles.push(file);
  return file;
}

afterEach(() => {
  while (tmpFiles.length) fs.rmSync(tmpFiles.pop(), { force: true });
});

async function collect(filePath) {
  const out = [];
  for await (const card of readCardObjects(filePath)) out.push(card);
  return out;
}

describe('readCardObjects', () => {
  it('reads a gzipped .jsonl.gz file', async () => {
    const file = tmpFile('gz.jsonl.gz');
    fs.writeFileSync(file, zlib.gzipSync(Buffer.from(jsonl)));
    expect(await collect(file)).toEqual(cards);
  });

  it('reads a plain (already-decompressed) .jsonl.gz file', async () => {
    const file = tmpFile('plain.jsonl.gz');
    fs.writeFileSync(file, Buffer.from(jsonl));
    expect(await collect(file)).toEqual(cards);
  });
});
