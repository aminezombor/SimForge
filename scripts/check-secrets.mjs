// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  ['OpenAI-style key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['NVIDIA API key', /\bnvapi-[A-Za-z0-9_-]{20,}\b/],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
];

const listed = spawnSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'buffer', windowsHide: true },
);
if (listed.status !== 0) {
  process.stderr.write('Unable to enumerate repository files for secret scanning.\n');
  process.exit(1);
}

const files = listed.stdout.toString('utf8').split('\0').filter(Boolean);
const findings = [];
for (const file of files) {
  let data;
  try {
    data = readFileSync(file);
  } catch {
    continue;
  }
  if (data.includes(0) || data.byteLength > 5_000_000) continue;
  const text = data.toString('utf8');
  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length) {
  process.stderr.write(`Potential secrets detected:\n${findings.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Secret scan passed (${files.length} repository files checked).\n`);
