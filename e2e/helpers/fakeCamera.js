// Writes a video file showing one EAN-13 barcode, for Edge's fake camera
// (--use-file-for-fake-video-capture). Lets the scanner be tested with no
// real camera or phone attached.
import fs from 'node:fs';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((code) => code.replace(/./g, (bit) => (bit === '1' ? '0' : '1')));
const G = R.map((code) => code.split('').reverse().join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13(twelveDigits) {
  const digits = twelveDigits.split('').map(Number);
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return twelveDigits + ((10 - (sum % 10)) % 10);
}

function ean13Modules(code) {
  const digits = code.split('').map(Number);
  const parity = PARITY[digits[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i += 1) bits += (parity[i - 1] === 'L' ? L : G)[digits[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i += 1) bits += R[digits[i]];
  return `${bits}101`;
}

function drawBarcode(luma, width, code, module, top, bottom) {
  const modules = ean13Modules(code);
  const left = Math.floor((width - modules.length * module) / 2);
  for (let m = 0; m < modules.length; m += 1) {
    if (modules[m] !== '1') continue;
    for (let y = top; y < bottom; y += 1) {
      luma.fill(16, y * width + left + m * module, y * width + left + (m + 1) * module);
    }
  }
}

// above: a second barcode drawn in a strip at the top of the picture, outside the
// scanner's green box, like the next barcode on a printed sheet.
export function writeBarcodeVideo(file, code, { width = 640, height = 480, module = 4, frames = 3, above } = {}) {
  const luma = Buffer.alloc(width * height, 235);
  if (above) {
    drawBarcode(luma, width, above, module, Math.floor(height * 0.02), Math.floor(height * 0.16));
    drawBarcode(luma, width, code, module, Math.floor(height * 0.34), Math.floor(height * 0.72));
  } else {
    drawBarcode(luma, width, code, module, Math.floor(height * 0.2), Math.floor(height * 0.8));
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\n`);
  fs.writeFileSync(file, Buffer.concat([header, ...Array(frames).fill(frame)]));
}
