import fs from 'node:fs';
import dicomParser from 'dicom-parser';
import sharp from 'sharp';

/**
 * Decodificador básico en JS puro para JPEG Lossless (SOF 0xC3 / Transfer Syntaxes 1.2.840.10008.1.2.4.70 y 1.2.840.10008.1.2.4.57).
 */
function decodeJpegLossless(buffer) {
  let offset = 0;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('No es un archivo JPEG válido.');
  }
  offset += 2;

  let precision = 16, rows = 0, cols = 0;
  const huffmanTables = [];
  let predictor = 1, pointTransform = 0;
  let scanStart = 0;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8) { offset += 2; continue; }
    if (marker === 0xd9) break; // EOI

    const len = (buffer[offset + 2] << 8) | buffer[offset + 3];

    if (marker === 0xc3) { // SOF3 (Lossless)
      precision = buffer[offset + 4];
      rows = (buffer[offset + 5] << 8) | buffer[offset + 6];
      cols = (buffer[offset + 7] << 8) | buffer[offset + 8];
      offset += 2 + len;
    } else if (marker === 0xc4) { // DHT (Huffman Table)
      let tableOffset = offset + 4;
      const endTable = offset + 2 + len;
      while (tableOffset < endTable) {
        const info = buffer[tableOffset++];
        const tableIndex = info & 0x0f;
        const bits = new Uint8Array(16);
        for (let i = 0; i < 16; i++) bits[i] = buffer[tableOffset++];
        let numCodes = 0;
        for (let i = 0; i < 16; i++) numCodes += bits[i];
        const values = new Uint8Array(numCodes);
        for (let i = 0; i < numCodes; i++) values[i] = buffer[tableOffset++];
        
        huffmanTables[tableIndex] = buildHuffmanTable(bits, values);
      }
      offset += 2 + len;
    } else if (marker === 0xda) { // SOS (Start of Scan)
      const ns = buffer[offset + 4];
      let sosOffset = offset + 5 + ns * 2;
      predictor = buffer[sosOffset];
      pointTransform = buffer[sosOffset + 2] & 0x0f;
      offset += 2 + len;
      scanStart = offset;
      break;
    } else {
      offset += 2 + len;
    }
  }

  function buildHuffmanTable(bits, values) {
    const table = [];
    let code = 0, valIdx = 0;
    for (let i = 1; i <= 16; i++) {
      const count = bits[i - 1];
      for (let j = 0; j < count; j++) {
        table.push({ code: code, length: i, value: values[valIdx++] });
        code++;
      }
      code <<= 1;
    }
    return table;
  }

  class BitReader {
    constructor(buf, pos) {
      this.buf = buf;
      this.pos = pos;
      this.bitBuf = 0;
      this.bitsCount = 0;
    }
    readBit() {
      if (this.bitsCount === 0) {
        let byte = this.buf[this.pos++];
        if (byte === 0xff && this.buf[this.pos] === 0x00) this.pos++;
        this.bitBuf = byte;
        this.bitsCount = 8;
      }
      this.bitsCount--;
      return (this.bitBuf >> this.bitsCount) & 1;
    }
    readBits(n) {
      let res = 0;
      for (let i = 0; i < n; i++) res = (res << 1) | this.readBit();
      return res;
    }
    decodeHuffman(table) {
      let code = 0;
      for (let len = 1; len <= 16; len++) {
        code = (code << 1) | this.readBit();
        for (let i = 0; i < table.length; i++) {
          if (table[i].length === len && table[i].code === code) return table[i].value;
        }
      }
      throw new Error('Código Huffman no válido en el fragmento JPEG Lossless.');
    }
  }

  const reader = new BitReader(buffer, scanStart);
  const hTable = huffmanTables[0] || huffmanTables[1];
  if (!hTable) throw new Error('Tabla Huffman no encontrada para JPEG Lossless.');

  const output = new Uint16Array(rows * cols);
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const category = reader.decodeHuffman(hTable);
      let diff = 0;
      if (category > 0) {
        const val = reader.readBits(category);
        diff = (val < (1 << (category - 1))) ? val - (1 << category) + 1 : val;
      }
      if (pointTransform > 0) diff <<= pointTransform;

      let pred = 0;
      if (c === 0 && r === 0) {
        pred = 1 << (precision - 1);
      } else if (c === 0) {
        pred = output[(r - 1) * cols];
      } else if (r === 0) {
        pred = output[r * cols + c - 1];
      } else {
        if (predictor === 1) pred = output[r * cols + c - 1];
        else if (predictor === 2) pred = output[(r - 1) * cols + c];
        else if (predictor === 3) pred = output[(r - 1) * cols + c - 1];
        else pred = output[r * cols + c - 1];
      }

      output[r * cols + c] = (pred + diff) & 0xffff;
    }
  }

  return { rows, cols, precision, output };
}

/**
 * Convierte un archivo DICOM a un Buffer JPEG utilizando dicom-parser y sharp.
 * Soporta DICOMs sin comprimir (8/16-bit MONOCHROME y RGB) y comprimidos (JPEG Baseline y JPEG Lossless).
 * @param {string} filePath - Ruta absoluta al archivo DICOM.
 * @returns {Promise<Buffer>} Buffer del archivo JPG resultante.
 */
export const convertDicomToJpgBuffer = async (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const dataSet = dicomParser.parseDicom(fileBuffer);

  const pixelDataElement = dataSet.elements.x7fe00010;
  if (!pixelDataElement) {
    throw new Error('El archivo DICOM no contiene elemento de PixelData.');
  }

  const rows = dataSet.uint16('x00280010');
  const cols = dataSet.uint16('x00280011');
  if (!rows || !cols) {
    throw new Error('Dimensiones de la imagen (filas/columnas) no especificadas en el DICOM.');
  }

  const photometricInterpretation = (dataSet.string('x00280004') || 'MONOCHROME2').trim().toUpperCase();
  const bitsAllocated = dataSet.uint16('x00280100') || 16;
  const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0: Unsigned, 1: Signed
  const rescaleIntercept = parseFloat(dataSet.string('x00281052') || '0');
  const rescaleSlope = parseFloat(dataSet.string('x00281053') || '1');

  // 1. Si el archivo contiene datos de píxel encapsulados (compresión JPEG / JPEG Lossless)
  if (pixelDataElement.encapsulatedPixelData && pixelDataElement.fragments && pixelDataElement.fragments.length > 0) {
    for (const frag of pixelDataElement.fragments) {
      if (!frag || frag.length === 0) continue;
      const fragBuf = fileBuffer.subarray(frag.position, frag.position + frag.length);
      
      // Intentar decodificación directa con sharp (útil para JPEG Baseline / Lossy)
      try {
        return await sharp(fragBuf).jpeg({ quality: 90 }).toBuffer();
      } catch (err) {
        // Si sharp falla por formato de compresión como JPEG Lossless (SOF 0xC3)
        if (err.message.includes('0xc3') || err.message.includes('Unsupported JPEG process')) {
          const res = decodeJpegLossless(fragBuf);
          const numPixels = res.rows * res.cols;
          
          let min = Infinity, max = -Infinity;
          const windowCenterStr = dataSet.string('x00281050');
          const windowWidthStr = dataSet.string('x00281051');
          let wc, ww;
          
          if (windowCenterStr && windowWidthStr) {
            wc = parseFloat(windowCenterStr.split('\\')[0]);
            ww = parseFloat(windowWidthStr.split('\\')[0]);
          } else {
            for (let i = 0; i < numPixels; i++) {
              const v = res.output[i] * rescaleSlope + rescaleIntercept;
              if (v < min) min = v;
              if (v > max) max = v;
            }
            wc = (min + max) / 2;
            ww = Math.max(max - min, 1);
          }

          const grayBuffer = Buffer.alloc(numPixels);
          const lowerBound = wc - 0.5 - (ww - 1) / 2;
          const upperBound = wc - 0.5 + (ww - 1) / 2;
          const isMono1 = photometricInterpretation === 'MONOCHROME1';

          for (let i = 0; i < numPixels; i++) {
            const rawVal = res.output[i];
            const rescaled = rawVal * rescaleSlope + rescaleIntercept;
            let displayVal;
            if (rescaled <= lowerBound) {
              displayVal = 0;
            } else if (rescaled > upperBound) {
              displayVal = 255;
            } else {
              displayVal = Math.round(((rescaled - (wc - 0.5)) / (ww - 1) + 0.5) * 255);
            }
            if (isMono1) displayVal = 255 - displayVal;
            grayBuffer[i] = Math.max(0, Math.min(255, displayVal));
          }

          return await sharp(grayBuffer, {
            raw: { width: res.cols, height: res.rows, channels: 1 }
          }).jpeg({ quality: 90 }).toBuffer();
        }
        throw err;
      }
    }
  }

  // 2. Procesar datos de píxel sin comprimir (MONOCHROME1, MONOCHROME2, RGB)
  const numPixels = rows * cols;

  if (photometricInterpretation === 'RGB' && bitsAllocated === 8) {
    const rawPixelData = fileBuffer.subarray(
      pixelDataElement.dataOffset,
      pixelDataElement.dataOffset + pixelDataElement.length
    );
    return await sharp(rawPixelData, {
      raw: { width: cols, height: rows, channels: 3 }
    }).jpeg({ quality: 90 }).toBuffer();
  }

  // Copia segura de ArrayBuffer para evitar RangeError por alineamiento en TypedArrays
  const bufferCopy = fileBuffer.buffer.slice(
    fileBuffer.byteOffset + pixelDataElement.dataOffset,
    fileBuffer.byteOffset + pixelDataElement.dataOffset + pixelDataElement.length
  );

  let pixelArray;
  if (bitsAllocated === 8) {
    pixelArray = pixelRepresentation === 1 ? new Int8Array(bufferCopy) : new Uint8Array(bufferCopy);
  } else {
    pixelArray = pixelRepresentation === 1 ? new Int16Array(bufferCopy) : new Uint16Array(bufferCopy);
  }

  let wc, ww;
  const windowCenterStr = dataSet.string('x00281050');
  const windowWidthStr = dataSet.string('x00281051');

  if (windowCenterStr && windowWidthStr) {
    wc = parseFloat(windowCenterStr.split('\\')[0]);
    ww = parseFloat(windowWidthStr.split('\\')[0]);
  } else {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < numPixels; i++) {
      const val = pixelArray[i] * rescaleSlope + rescaleIntercept;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    wc = (min + max) / 2;
    ww = Math.max(max - min, 1);
  }

  const grayBuffer = Buffer.alloc(numPixels);
  const lowerBound = wc - 0.5 - (ww - 1) / 2;
  const upperBound = wc - 0.5 + (ww - 1) / 2;
  const isMono1 = photometricInterpretation === 'MONOCHROME1';

  for (let i = 0; i < numPixels; i++) {
    const rawVal = pixelArray[i];
    const rescaled = rawVal * rescaleSlope + rescaleIntercept;
    let displayVal;
    if (rescaled <= lowerBound) {
      displayVal = 0;
    } else if (rescaled > upperBound) {
      displayVal = 255;
    } else {
      displayVal = Math.round(((rescaled - (wc - 0.5)) / (ww - 1) + 0.5) * 255);
    }
    if (isMono1) displayVal = 255 - displayVal;
    grayBuffer[i] = Math.max(0, Math.min(255, displayVal));
  }

  return await sharp(grayBuffer, {
    raw: { width: cols, height: rows, channels: 1 }
  }).jpeg({ quality: 90 }).toBuffer();
};
