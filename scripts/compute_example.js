// scripts/compute_example.js
// Computes a high-variance base-6 (LSB-first) worked example for the README.
// Node 16+ (BigInt available). Requires `bip39` package.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bip39 = require('bip39');

// LSB-first rolls (first = least-significant base-6 digit)
const rolls = [
 2,5,3,6,1,4,6,2,3,5,
 4,1,6,2,2,5,3,4,6,1,
 2,6,5,3,4,2,1,6,5,5,
 3,2,4,1,6,2,5,3,1,4,
 6,2,3,5,1,4,2,6,3,5
];

// map to base-6 digits (digit = roll - 1)
const digits = rolls.map(r => r - 1);

// compute N = sum digits[i] * 6^i (LSB-first)
let N = 0n;
let pow = 1n;
for (const d of digits) {
  N += BigInt(d) * pow;
  pow *= 6n;
}

// Convert N to 16-byte little-endian buffer
const BYTE_LEN = 16;
const bytes = Buffer.alloc(BYTE_LEN, 0);
let tmp = N;
for (let i = 0; i < BYTE_LEN; i++) {
  bytes[i] = Number(tmp & 0xffn);
  tmp >>= 8n;
}

const rawHexLSB = bytes.toString('hex');

// SHA-256 digest
const digest = crypto.createHash('sha256').update(bytes).digest();
const digestHex = digest.toString('hex');

// checksum bits: CS = 128/32 = 4 -> first 4 bits of digest (MSB-first)
function takeFirstBitsFromDigest(digestBuf, cs) {
  let bits = '';
  for (const b of digestBuf) {
    bits += b.toString(2).padStart(8, '0');
    if (bits.length >= cs) break;
  }
  return bits.slice(0, cs);
}
const csBits = takeFirstBitsFromDigest(digest, 4);

// form S: raw entropy bits (MSB-first per byte) + csBits
function bytesToBitStringMSB(bytesBuf) {
  let s = '';
  for (let i = 0; i < bytesBuf.length; i++) {
    s += bytesBuf[i].toString(2).padStart(8, '0');
  }
  return s;
}
const rawBitsMSB = bytesToBitStringMSB(bytes);
const S = rawBitsMSB + csBits; // 132 bits

// split into 11-bit MSB-first words
function chunkToWords(bitstring, chunkSize = 11) {
  const words = [];
  for (let i = 0; i < bitstring.length; i += chunkSize) {
    const chunk = bitstring.slice(i, i + chunkSize);
    if (chunk.length < chunkSize) break;
    words.push(parseInt(chunk, 2));
  }
  return words;
}
const indices = chunkToWords(S, 11);

// map to bip39 words
const wordlist = bip39.wordlists.english;
const mnemonicWords = indices.map(i => wordlist[i]);

// Prepare markdown block
const md = [];
md.push('### High‑variance worked example — computed outputs (LSB base‑6, 12 words)');
md.push('');
md.push('Roll sequence (LSB first):');
md.push('');
md.push('`' + rolls.join(', ') + '`');
md.push('');
md.push('Base‑6 digits (LSB first, digit = roll − 1):');
md.push('');
md.push('`' + digits.join(', ') + '`');
md.push('');
md.push('Integer N (decimal):');
md.push('');
md.push('`' + N.toString() + '`');
md.push('');
md.push('Raw entropy (16 bytes, LSB byte order):');
md.push('');
md.push('`' + rawHexLSB + '`');
md.push('');
md.push('SHA‑256 digest (hex):');
md.push('');
md.push('`' + digestHex + '`');
md.push('');
md.push('Checksum bits (first 4 bits of digest, MSB‑first):');
md.push('');
md.push('`' + csBits + '`');
md.push('');
md.push('BIP‑39 11‑bit indices:');
md.push('');
md.push('`' + indices.join(', ') + '`');
md.push('');
md.push('Mnemonic (12 words):');
md.push('');
md.push('`' + mnemonicWords.join(' ') + '`');
md.push('');
md.push('---');

const block = md.join('\n');

// Append to TECHNICAL_README.md
const readmePath = path.join(process.cwd(), 'TECHNICAL_README.md');
let readme = '';
try {
  readme = fs.readFileSync(readmePath, 'utf8');
} catch (e) {
  console.error('Failed to read TECHNICAL_README.md:', e.message);
  process.exit(1);
}

// Avoid duplicate insertions: check for existing marker
if (readme.includes('High‑variance worked example — computed outputs (LSB base‑6, 12 words)')) {
  console.log('README already contains computed outputs; exiting.');
  process.exit(0);
}

const newReadme = readme + '\n\n' + block + '\n';
fs.writeFileSync(readmePath, newReadme, 'utf8');
console.log('Appended computed example to TECHNICAL_README.md');
