import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';

// Sniff the gzip magic number instead of trusting the file extension or
// response headers: Node's fetch transparently decompresses
// `Content-Encoding: gzip` responses, so a saved .jsonl.gz may already be
// plain JSONL on disk.
function isGzip(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    return buf[0] === 0x1f && buf[1] === 0x8b;
  } finally {
    fs.closeSync(fd);
  }
}

export async function* readCardObjects(filePath) {
  const raw = fs.createReadStream(filePath);
  const input = isGzip(filePath) ? raw.pipe(zlib.createGunzip()) : raw;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    yield JSON.parse(line);
  }
}
