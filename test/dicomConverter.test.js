import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertDicomToJpgBuffer } from '../utils/dicomConverter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DICOM_PATH = path.join(
  __dirname,
  '../archivos de prueba/P10007415_K/S1_3_6_1_4_1_19179_1_110452026224892_1_6230_2142/M1_3_6_1_4_1_19179_1_110452026224892_2_6586_2143/1.3.6.1.4.1.19179.1.110452026224892.3.6586.2144.dcm'
);

test('convertDicomToJpgBuffer convierte exitosamente un archivo DICOM a JPG Buffer', async () => {
  const jpgBuffer = await convertDicomToJpgBuffer(TEST_DICOM_PATH);

  assert.ok(Buffer.isBuffer(jpgBuffer), 'El resultado debe ser un Buffer');
  assert.ok(jpgBuffer.length > 0, 'El buffer no debe estar vacío');

  // Verificar la firma del formato JPEG (0xFF 0xD8)
  assert.strictEqual(jpgBuffer[0], 0xff, 'El primer byte de un archivo JPG debe ser 0xFF');
  assert.strictEqual(jpgBuffer[1], 0xd8, 'El segundo byte de un archivo JPG debe ser 0xD8');
});

test('convertDicomToJpgBuffer lanza un error si el archivo DICOM no existe', async () => {
  await assert.rejects(
    async () => {
      await convertDicomToJpgBuffer('./non_existent_file.dcm');
    },
    {
      name: 'Error'
    }
  );
});
