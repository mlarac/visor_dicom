import fs from 'node:fs';
import dicomParser from 'dicom-parser';
import sharp from 'sharp';

/**
 * Convierte un archivo DICOM (.dcm) a un Buffer JPEG utilizando dicom-parser y sharp.
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

  const rawPixelData = fileBuffer.subarray(
    pixelDataElement.dataOffset,
    pixelDataElement.dataOffset + pixelDataElement.length
  );

  // 1. Comprobar si el archivo contiene datos JPEG encapsulados (Start of Image 0xFFD8)
  const soiIndex = rawPixelData.indexOf(Buffer.from([0xff, 0xd8]));
  const eoiIndex = rawPixelData.lastIndexOf(Buffer.from([0xff, 0xd9]));

  if (soiIndex !== -1 && eoiIndex !== -1 && eoiIndex > soiIndex) {
    const encapsulatedJpeg = rawPixelData.subarray(soiIndex, eoiIndex + 2);
    // Usar sharp para asegurar la salida normalizada JPEG
    return await sharp(encapsulatedJpeg).jpeg({ quality: 90 }).toBuffer();
  }

  // 2. Procesar datos de píxel sin comprimir (MONOCHROME1, MONOCHROME2, RGB)
  const photometricInterpretation = (dataSet.string('x00280004') || 'MONOCHROME2').trim().toUpperCase();
  const bitsAllocated = dataSet.uint16('x00280100') || 16;
  const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0: Unsigned, 1: Signed
  const rescaleIntercept = parseFloat(dataSet.string('x00281052') || '0');
  const rescaleSlope = parseFloat(dataSet.string('x00281053') || '1');
  const windowCenterStr = dataSet.string('x00281050');
  const windowWidthStr = dataSet.string('x00281051');

  // Si es RGB 8-bit
  if (photometricInterpretation === 'RGB' && bitsAllocated === 8) {
    return await sharp(rawPixelData, {
      raw: {
        width: cols,
        height: rows,
        channels: 3
      }
    })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // Obtener arreglo TypedArray según bitsAllocated y pixelRepresentation
  const numPixels = rows * cols;
  let pixelArray;
  const byteOffset = fileBuffer.byteOffset + pixelDataElement.dataOffset;

  if (bitsAllocated === 8) {
    if (pixelRepresentation === 1) {
      pixelArray = new Int8Array(fileBuffer.buffer, byteOffset, numPixels);
    } else {
      pixelArray = new Uint8Array(fileBuffer.buffer, byteOffset, numPixels);
    }
  } else {
    if (pixelRepresentation === 1) {
      pixelArray = new Int16Array(fileBuffer.buffer, byteOffset, numPixels);
    } else {
      pixelArray = new Uint16Array(fileBuffer.buffer, byteOffset, numPixels);
    }
  }

  // Determinar Window Center y Window Width
  let wc, ww;
  if (windowCenterStr && windowWidthStr) {
    wc = parseFloat(windowCenterStr.split('\\')[0]);
    ww = parseFloat(windowWidthStr.split('\\')[0]);
  } else {
    // Calcular min y max en caso de que no existan tags de ventana
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < numPixels; i++) {
      const val = pixelArray[i] * rescaleSlope + rescaleIntercept;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    wc = (min + max) / 2;
    ww = Math.max(max - min, 1);
  }

  // Transformar píxeles a escala de grises de 8 bits (VOI LUT)
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
    if (isMono1) {
      displayVal = 255 - displayVal;
    }
    grayBuffer[i] = Math.max(0, Math.min(255, displayVal));
  }

  // Generar Buffer JPEG a partir del Buffer de escala de grises de 1 canal
  return await sharp(grayBuffer, {
    raw: {
      width: cols,
      height: rows,
      channels: 1
    }
  })
    .jpeg({ quality: 90 })
    .toBuffer();
};
