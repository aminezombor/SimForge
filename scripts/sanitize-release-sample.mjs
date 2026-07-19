// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sampleRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!sampleRoot) throw new Error('Usage: node scripts/sanitize-release-sample.mjs <sample-root>');

const ownerProfile = process.env.USERPROFILE;
if (!ownerProfile) throw new Error('USERPROFILE is required to sanitize the Windows release sample');
const neutralProfile = (separator) => {
  const source = ownerProfile.replaceAll(separator === '\\' ? '/' : '\\', separator);
  const sourceBytes = Buffer.byteLength(source);
  if (sourceBytes < 4) throw new Error('USERPROFILE is too short to sanitize safely');
  return `C:${separator}${'SimForgeDemo'.padEnd(sourceBytes - 3, '_').slice(0, sourceBytes - 3)}`;
};
const replacements = [
  [ownerProfile.replaceAll('/', '\\'), neutralProfile('\\')],
  [ownerProfile.replaceAll('\\', '/'), neutralProfile('/')],
];
for (const [source, replacement] of replacements) {
  if (Buffer.byteLength(source) !== Buffer.byteLength(replacement)) {
    throw new Error('Release path replacement must preserve byte length');
  }
}

const blendFiles = [
  path.join(sampleRoot, 'scene', 'project.blend'),
  path.join(sampleRoot, 'exports', 'verified-warehouse', 'source', 'project.blend'),
];
let replacementCount = 0;
let sanitizedMarkerCount = 0;
for (const blendFile of blendFiles) {
  let content = await readFile(blendFile);
  for (const [source, replacement] of replacements) {
    const needle = Buffer.from(source, 'utf8');
    const value = Buffer.from(replacement, 'utf8');
    let offset = content.indexOf(needle);
    while (offset >= 0) {
      value.copy(content, offset);
      replacementCount += 1;
      offset = content.indexOf(needle, offset + value.length);
    }
  }
  for (const [, replacement] of replacements) {
    if (content.includes(Buffer.from(replacement, 'utf8'))) sanitizedMarkerCount += 1;
  }
  await writeFile(blendFile, content);
}

const packageRoot = path.join(sampleRoot, 'exports', 'verified-warehouse');
const packagedBlend = path.join(packageRoot, 'source', 'project.blend');
const packagedBlendBytes = await readFile(packagedBlend);
const manifestPath = path.join(packageRoot, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = manifest.files?.find((file) => file.path === 'source/project.blend');
if (!entry) throw new Error('Canonical manifest does not inventory source/project.blend');
entry.bytes = packagedBlendBytes.length;
entry.sha256 = createHash('sha256').update(packagedBlendBytes).digest('hex');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(`${JSON.stringify({ ok: true, replacementCount, sanitizedMarkerCount, packagedBlendSha256: entry.sha256 })}\n`);
