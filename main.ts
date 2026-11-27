// Front page for Friday 27 November 2026. The finished illustration lives in
// this repository as asset.jpg: a projectile struck the Jazan refinery, killing
// one worker and halting operations (Saudi Energy Ministry, 26 Nov); Ukraine
// says its drones hit five warplanes at Savasleyka air base, deep inside Russia
// (Kyiv General Staff, 25–26 Nov); Washington proposed new tariffs on 14 trading
// partners, steepest on China (Reuters, 25 Nov); and the 100th Macy's
// Thanksgiving Day Parade was postponed for the first time ever as a coastal
// storm battered New York (Reuters/AP, 25 Nov). All four were checked against
// independent outlets this session. This program only delivers the picture: it
// validates the JPEG and writes it to /output/entry.png (a JPEG by its first
// bytes, as the rules allow, even though the filename ends in .png).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1024 * 1024;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;

// Markers with no length field after them (standalone or single-byte).
const STANDALONE = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8]);

function isFrameMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

// Walk the JPEG segment chain and return the frame size from the first SOF.
function readFrameSize(buf: Buffer): { width: number; height: number } {
  let pos = 2; // past the SOI marker
  while (pos + 9 < buf.length) {
    if (buf[pos] !== 0xff) {
      throw new Error(`news-image-20261127: bad marker prefix 0x${buf[pos].toString(16)} at offset ${pos}`);
    }
    const marker = buf[pos + 1];
    if (marker === 0xd9) break; // EOI: no frame header found
    if (STANDALONE.has(marker)) {
      pos += 2;
      continue;
    }
    const segLen = buf.readUInt16BE(pos + 2);
    if (segLen < 2 || pos + 2 + segLen > buf.length) {
      throw new Error(`news-image-20261127: bad segment length ${segLen} at offset ${pos}`);
    }
    if (isFrameMarker(marker)) {
      return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7) };
    }
    pos += 2 + segLen;
  }
  throw new Error("news-image-20261127: no JPEG frame header in asset.jpg");
}

function validateJpeg(buf: Buffer): { width: number; height: number } {
  if (buf.length < 4 || buf.length > MAX_BYTES) {
    throw new Error(`news-image-20261127: asset.jpg is ${buf.length} bytes, must be 4..${MAX_BYTES}`);
  }
  if (buf.readUInt16BE(0) !== 0xffd8) {
    throw new Error("news-image-20261127: asset.jpg lacks the JPEG SOI marker");
  }
  if (buf.readUInt16BE(buf.length - 2) !== 0xffd9) {
    throw new Error("news-image-20261127: asset.jpg lacks the JPEG EOI marker");
  }
  const { width, height } = readFrameSize(buf);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    throw new Error(
      `news-image-20261127: asset.jpg is ${width}x${height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`,
    );
  }
  return { width, height };
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const assetPath = join(here, "asset.jpg");
  if (!existsSync(assetPath)) {
    throw new Error(`news-image-20261127: missing asset file ${assetPath}`);
  }
  const bytes = readFileSync(assetPath);
  const { width, height } = validateJpeg(bytes);
  const outDir = resolve(process.env.OUTPUT_DIR ?? "/output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const target = join(outDir, "entry.png");
  writeFileSync(target, bytes, { mode: 0o644 });
  // Post-write self-check: the delivered file must be the same picture.
  const delivered = readFileSync(target);
  if (delivered.length !== bytes.length || delivered.readUInt16BE(0) !== 0xffd8) {
    throw new Error(`news-image-20261127: ${target} failed the post-write check`);
  }
  console.log(`wrote ${target} (${bytes.length} bytes, ${width}x${height} JPEG)`);
}

main();
