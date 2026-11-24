// Post-X promote entry (Node 22, standard library only).
// The entry is one public post on X quoting make.fun's make-your-own-bounty
// post, with a photo of its own attached. POST.json beside this file names
// the post's address; POST_TEXT.txt holds the post's exact text; card.png is
// the photo attached to the post. The program validates all three first
// (post URL shape, required make.fun / @makefunai mention, play-code shape,
// PNG magic + dimensions + IEND of the photo), then writes a deterministic
// report to /output/entry.json and copies the photo to /output/card.png.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { chmodSync, copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const POST_JSON = new URL('./POST.json', import.meta.url);
const POST_TEXT = new URL('./POST_TEXT.txt', import.meta.url);
const PHOTO = new URL('./card.png', import.meta.url);

const post = JSON.parse(readFileSync(POST_JSON, 'utf8'));
const url = post.url;
const match = /^https:\/\/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/(\d+)$/.exec(url);
if (!match) throw new Error(`POST.json url is not an X post address: ${url}`);
const handle = match[1];
const statusId = match[2];

const text = readFileSync(POST_TEXT, 'utf8');
const hasMakefun = /(?:https?:\/\/[A-Za-z0-9.-]*make\.fun\b|make\.fun|@makefunai)/i.test(text);
if (!hasMakefun) throw new Error('POST_TEXT.txt carries neither make.fun nor @makefunai');
const codeMatch = /makefun-[a-z]+-[a-z]+-[a-z]+/.exec(text);
if (!codeMatch) throw new Error('POST_TEXT.txt carries no play code of the form makefun-word-word-word');
const playCode = codeMatch[0];
if (!text.includes('https://make.fun/sponsor/new')) {
  throw new Error('POST_TEXT.txt is missing the sponsor line https://make.fun/sponsor/new');
}

const bytes = readFileSync(PHOTO);
const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!bytes.subarray(0, 8).equals(MAGIC)) throw new Error('card.png is not a PNG');
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
const IEND = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
if (!bytes.subarray(bytes.length - 12).equals(IEND)) {
  throw new Error('card.png is truncated: no IEND chunk at the end');
}
console.log(`post OK: @${handle} status ${statusId}, play code ${playCode}`);
console.log(`photo OK: ${width}x${height}, ${bytes.length} bytes`);

const report = {
  competition: 'post-x-promote-make-your-own-bounty-01',
  post_url: url,
  handle,
  status_id: statusId,
  play_code: playCode,
  photo: { file: 'card.png', bytes: bytes.length, width, height },
  checks: ['post_url_shape', 'makefun_mention', 'play_code', 'sponsor_line', 'photo_png'],
};

mkdirSync(OUT_DIR, { recursive: true });
const reportPath = join(OUT_DIR, 'entry.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o644 });
const photoPath = join(OUT_DIR, 'card.png');
copyFileSync(PHOTO, photoPath);
// The grader collects /output as another user, so outputs must be
// world-readable whatever the umask is (writeFileSync's mode is masked
// by it, and copyFileSync keeps the source's mode).
chmodSync(reportPath, 0o644);
chmodSync(photoPath, 0o644);
console.log(`wrote ${reportPath}`);
