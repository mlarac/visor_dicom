import fs from 'node:fs/promises';
import dicomParser from 'dicom-parser';
import sharp from 'sharp';

/**
 * Construye una tabla Huffman a partir de los bits y valores del segmento DHT.
 * @param {Uint8Array} bits - Conteo de códigos por longitud (16 entradas).
 * @param {Uint8Array} values - Valores asociados a cada código.
 * @returns {Array<{code: number, length: number, value: number}>}
 */
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

/**
 * Clase para lectura de bits desde un buffer JPEG, manejando byte-stuffing y marcadores RST.
 */
class BitReader {
  constructor(buf, pos) {
    this.buf = buf;
    this.pos = pos;
    this.bitBuf = 0;
    this.bitsCount = 0;
  }
  readBit() {
    if (this.bitsCount === 0) {
      if (this.pos >= this.buf.length) return 0;
      const byte = this.buf[this.pos++];
      if (byte === 0xff) {
        const nextByte = this.buf[this.pos];
        // byte-stuffing (0x00) y marcadores de reinicio RST0-RST7 se saltan
        if (nextByte === 0x00 || (nextByte >= 0xd0 && nextByte <= 0xd7)) {
          this.pos++;
        }
      }
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
      for (const entry of table) {
        if (entry.length === len && entry.code === code) return entry.value;
      }
    }
    return 0;
  }
}

/**
 * Parsea las cabeceras JPEG para extraer SOF3, DHT y SOS de un buffer JPEG Lossless.
 * @param {Buffer} buffer
 * @returns {{precision: number, rows: number, cols: number, huffmanTables: Array, predictor: number, pointTransform: number, scanStart: number}}
 */
function parseJpegHeaders(buffer) {
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
    if (buffer[offset] !== 0xff) { offset++; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8) { offset += 2; continue; }
    if (marker === 0xd9) break;

    const len = (buffer[offset + 2] << 8) | buffer[offset + 3];

    if (marker === 0xc3) {
      precision = buffer[offset + 4];
      rows = (buffer[offset + 5] << 8) | buffer[offset + 6];
      cols = (buffer[offset + 7] << 8) | buffer[offset + 8];
    } else if (marker === 0xc4) {
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
    } else if (marker === 0xda) {
      const ns = buffer[offset + 4];
      const sosOffset = offset + 5 + ns * 2;
      predictor = buffer[sosOffset];
      pointTransform = buffer[sosOffset + 2] & 0x0f;
      offset += 2 + len;
      scanStart = offset;
      break;
    }

    offset += 2 + len;
  }

  return { precision, rows, cols, huffmanTables, predictor, pointTransform, scanStart };
}

/**
 * Calcula el predictor DPCM para un píxel dado según ISO 10918-1.
 * @param {Uint16Array} output - Arreglo de salida con los valores decodificados.
 * @param {number} r - Fila actual.
 * @param {number} c - Columna actual.
 * @param {number} cols - Número de columnas.
 * @param {number} predictor - Selector de predictor (1-7).
 * @param {number} initialPred - Valor inicial del predictor.
 * @returns {number}
 */
function getPrediction(output, r, c, cols, predictor, initialPred) {
  if (c === 0 && r === 0) return initialPred;
  if (c === 0) return output[(r - 1) * cols];
  if (r === 0) return output[r * cols + c - 1];
  if (predictor === 2) return output[(r - 1) * cols + c];
  if (predictor === 3) return output[(r - 1) * cols + c - 1];
  // predictor === 1 u otros valores por defecto
  return output[r * cols + c - 1];
}

/**
 * Decodificador en JS puro para JPEG Lossless (SOF 0xC3 / Transfer Syntaxes 1.2.840.10008.1.2.4.70 y 1.2.840.10008.1.2.4.57).
 * Cumple con el estándar ISO 10918-1 / DICOM PS 3.5.
 */
function decodeJpegLossless(buffer) {
  const { precision, rows, cols, huffmanTables, predictor, pointTransform, scanStart } = parseJpegHeaders(buffer);

  const reader = new BitReader(buffer, scanStart);
  const hTable = huffmanTables[0] || huffmanTables[1];
  if (!hTable) throw new Error('Tabla Huffman no encontrada para JPEG Lossless.');

  const output = new Uint16Array(rows * cols);
  const initialPred = 1 << (precision - 1); // ISO 10918-1 DPCM Initial Predictor

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const category = reader.decodeHuffman(hTable);
      let diff = 0;
      if (category > 0) {
        const val = reader.readBits(category);
        diff = (val < (1 << (category - 1))) ? val - (1 << category) + 1 : val;
      }
      if (pointTransform > 0) diff <<= pointTransform;

      const pred = getPrediction(output, r, c, cols, predictor, initialPred);
      output[r * cols + c] = (pred + diff) & 0xffff;
    }
  }

  return { rows, cols, precision, output };
}

/**
 * Calcula los valores de Window Center (wc) y Window Width (ww) para un conjunto de píxeles.
 * Usa los valores del dataset DICOM si están disponibles y son válidos; si no, auto-windowing min/max.
 * @param {object} dataSet - Dataset DICOM parseado.
 * @param {number} min - Valor mínimo de píxel rescalado.
 * @param {number} max - Valor máximo de píxel rescalado.
 * @returns {{wc: number, ww: number}}
 */
function computeWindowValues(dataSet, min, max) {
  const windowCenterStr = dataSet.string('x00281050');
  const windowWidthStr = dataSet.string('x00281051');

  if (windowCenterStr && windowWidthStr) {
    const wc = Number.parseFloat(windowCenterStr.split('\\')[0]);
    const ww = Number.parseFloat(windowWidthStr.split('\\')[0]);
    const lower = wc - ww / 2;
    const upper = wc + ww / 2;
    // Si los valores de ventana del DICOM están fuera del rango real de píxeles, usar auto-windowing min/max
    if (lower < max && upper > min && (upper - lower) > 0) {
      return { wc, ww };
    }
  }

  return { wc: (min + max) / 2, ww: Math.max(max - min, 1) };
}

/**
 * Aplica windowing (VOI LUT) a un arreglo de píxeles y devuelve un buffer de 8-bit grayscale.
 * @param {TypedArray} pixelArray - Arreglo de valores de píxel (Int8, Uint8, Int16, Uint16).
 * @param {number} numPixels - Número total de píxeles.
 * @param {number} rescaleSlope - Pendiente de rescalado.
 * @param {number} rescaleIntercept - Intercepto de rescalado.
 * @param {number} wc - Window Center.
 * @param {number} ww - Window Width.
 * @param {boolean} isMono1 - true si la interpretación fotométrica es MONOCHROME1.
 * @returns {Buffer}
 */
function applyWindowing(pixelArray, numPixels, rescaleSlope, rescaleIntercept, wc, ww, isMono1) {
  const grayBuffer = Buffer.alloc(numPixels);
  const lowerBound = wc - 0.5 - (ww - 1) / 2;
  const upperBound = wc - 0.5 + (ww - 1) / 2;

  for (let i = 0; i < numPixels; i++) {
    const rescaled = pixelArray[i] * rescaleSlope + rescaleIntercept;
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

  return grayBuffer;
}

/**
 * Calcula el rango min/max de los valores rescalados de un arreglo de píxeles.
 * @param {TypedArray} pixelArray
 * @param {number} numPixels
 * @param {number} rescaleSlope
 * @param {number} rescaleIntercept
 * @returns {{min: number, max: number}}
 */
function computePixelRange(pixelArray, numPixels, rescaleSlope, rescaleIntercept) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < numPixels; i++) {
    const val = pixelArray[i] * rescaleSlope + rescaleIntercept;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return { min, max };
}

/**
 * Convierte un archivo DICOM a un Buffer JPEG utilizando dicom-parser y sharp.
 * Soporta DICOMs sin comprimir (8/16-bit MONOCHROME y RGB) y comprimidos (JPEG Baseline y JPEG Lossless).
 * @param {string} filePath - Ruta absoluta al archivo DICOM.
 * @returns {Promise<Buffer>} Buffer del archivo JPG resultante.
 */
export const convertDicomToJpgBuffer = async (filePath) => {
  const fileBuffer = await fs.readFile(filePath);
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
  const rescaleIntercept = Number.parseFloat(dataSet.string('x00281052') || '0');
  const rescaleSlope = Number.parseFloat(dataSet.string('x00281053') || '1');
  const isMono1 = photometricInterpretation === 'MONOCHROME1';

  // 1. Si el archivo contiene datos de píxel encapsulados (compresión JPEG / JPEG Lossless)
  if (pixelDataElement.encapsulatedPixelData && pixelDataElement.fragments && pixelDataElement.fragments.length > 0) {
    for (const frag of pixelDataElement.fragments) {
      if (!frag || frag.length === 0) continue;
      const fragBuf = fileBuffer.subarray(frag.position, frag.position + frag.length);

      // Intentar decodificación directa con sharp (útil para JPEG Baseline / Lossy)
      try {
        return await sharp(fragBuf).jpeg({ quality: 90 }).toBuffer();
      } catch (err) {
        // Si sharp falla (ej. JPEG Lossless SOF3 / precisión de 12 o 16 bits no soportada por libvips)
        try {
          const res = decodeJpegLossless(fragBuf);
          const numPixels = res.rows * res.cols;
          const { min, max } = computePixelRange(res.output, numPixels, rescaleSlope, rescaleIntercept);
          const { wc, ww } = computeWindowValues(dataSet, min, max);
          const grayBuffer = applyWindowing(res.output, numPixels, rescaleSlope, rescaleIntercept, wc, ww, isMono1);

          return await sharp(grayBuffer, {
            raw: { width: res.cols, height: res.rows, channels: 1 }
          }).jpeg({ quality: 90 }).toBuffer();
        } catch {
          throw err;
        }
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

  const { min, max } = computePixelRange(pixelArray, numPixels, rescaleSlope, rescaleIntercept);
  const { wc, ww } = computeWindowValues(dataSet, min, max);
  const grayBuffer = applyWindowing(pixelArray, numPixels, rescaleSlope, rescaleIntercept, wc, ww, isMono1);

  return await sharp(grayBuffer, {
    raw: { width: cols, height: rows, channels: 1 }
  }).jpeg({ quality: 90 }).toBuffer();
};
