import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function splitPatch(input, directory) {
  const bytes = fs.readFileSync(input);
  if (bytes.length > 40 * 1024 * 1024) throw Error('Patch exceeds 40 MiB');
  const patch = JSON.parse(bytes);
  if (!/^\d+\.\d+\.\d+$/.test(patch.version) || !Array.isArray(patch.files) || !Array.isArray(patch.remove)) throw Error('Expected an ordinary release patch');
  fs.mkdirSync(directory, {recursive:true});
  const parts = [];
  for (let start = 0; start < bytes.length; start += 131072) {
    const part = bytes.subarray(start, start + 131072);
    const name = `${patch.version}.part-${String(parts.length + 1).padStart(3, '0')}`;
    fs.writeFileSync(path.join(directory, name), part);
    parts.push({name, size:part.length, sha256:hash(part)});
  }
  const index = {format:2, version:patch.version, size:bytes.length, sha256:hash(bytes), parts};
  const serialized = Buffer.from(JSON.stringify(index, null, 2) + '\n');
  const filename = path.join(directory, `${patch.version}.json`);
  fs.writeFileSync(filename, serialized);
  return {filename, version:patch.version, patchSha256:hash(serialized), parts:parts.length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, directory, requestFile] = process.argv.slice(2);
  if (!input || !directory) throw Error('Usage: node release/split-patch.mjs INPUT_PATCH OUTPUT_DIRECTORY [RELEASE_REQUEST]');
  const result = splitPatch(input, directory);
  if (requestFile) {
    const request = JSON.parse(fs.readFileSync(requestFile));
    if (request.version !== result.version || request.patch !== `release/patches/${result.version}.json`) throw Error('Release request version/path mismatch');
    request.patchSha256 = result.patchSha256;
    fs.writeFileSync(requestFile, JSON.stringify(request, null, 2) + '\n');
  }
  console.log(JSON.stringify(result));
}
