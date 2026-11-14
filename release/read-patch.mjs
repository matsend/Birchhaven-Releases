import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const maxPatchBytes = 96 * 1024 * 1024;
// Parts are repository-local, bounded and individually verified before joining.
// The resulting delta retains the same per-file and final-runtime checks.
export function readPatch(filename, expectedHash, version) {
  const indexBytes = fs.readFileSync(filename);
  if (indexBytes.length > maxPatchBytes || hash(indexBytes) !== expectedHash) throw Error('Patch checksum mismatch');
  const index = JSON.parse(indexBytes);
  if (index.format !== 2) return index;
  if (index.version !== version || !Array.isArray(index.parts) || !index.parts.length || index.parts.length > 768 ||
      !Number.isSafeInteger(index.size) || index.size <= 0 || index.size > maxPatchBytes || !/^[a-f0-9]{64}$/.test(index.sha256)) throw Error('Invalid multipart patch');
  const parts = [];
  let total = 0;
  for (const [i, part] of index.parts.entries()) {
    const expectedName = `${version}.part-${String(i + 1).padStart(3, '0')}`;
    if (part.name !== expectedName || !Number.isSafeInteger(part.size) || part.size <= 0 || part.size > 131072 || !/^[a-f0-9]{64}$/.test(part.sha256)) throw Error('Invalid patch part');
    const bytes = fs.readFileSync(path.join(path.dirname(filename), part.name));
    if (bytes.length !== part.size || hash(bytes) !== part.sha256) throw Error('Patch part checksum mismatch: ' + part.name);
    total += bytes.length;
    if (total > index.size) throw Error('Patch size mismatch');
    parts.push(bytes);
  }
  const bytes = Buffer.concat(parts);
  if (total !== index.size || hash(bytes) !== index.sha256) throw Error('Joined patch checksum mismatch');
  const patch = JSON.parse(bytes);
  if (patch.version !== version) throw Error('Patch version mismatch');
  return patch;
}

