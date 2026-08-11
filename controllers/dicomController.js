import * as dicomService from '../services/dicomService.js';
import path from 'node:path';
import fs from 'node:fs';
import { ZipArchive } from 'archiver';
import dicomParser from 'dicom-parser';
import { convertDicomToJpgBuffer } from '../utils/dicomConverter.js';

/**
 * Helper recursivo ultra rápido para buscar archivos DICOM válidos en subcarpetas.
 * Lee únicamente los primeros 4 KB de encabezado de cada archivo para minimizar RAM y latencia I/O.
 */
const getDicomFilesRecursive = (dir, baseDir) => {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getDicomFilesRecursive(filePath, baseDir));
    } else {
      const lowerName = file.toLowerCase();
      // Omitir manifiestos XML, zips, carpetas de sistema o archivos ocultos
      if (lowerName === 'dicomdir' || lowerName.endsWith('.xml') || lowerName.endsWith('.zip') || lowerName.endsWith('.json') || lowerName.startsWith('.')) {
        continue;
      }
      
      // Lectura ultra rápida: leer solo los primeros 4 KB de encabezado
      try {
        if (stat.size < 132) continue;

        const fd = fs.openSync(filePath, 'r');
        const headerBuf = Buffer.alloc(Math.min(4096, stat.size));
        fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
        fs.closeSync(fd);

        let dataSet;
        try {
          dataSet = dicomParser.parseDicom(headerBuf, { untilTag: 'x7fe00010' });
        } catch (parseErr) {
          // Fallback a lectura completa si el encabezado excede 4 KB
          const fileBuffer = fs.readFileSync(filePath);
          dataSet = dicomParser.parseDicom(fileBuffer);
        }

        const pixelDataElement = dataSet.elements.x7fe00010;
        const rows = dataSet.uint16('x00280010');
        const cols = dataSet.uint16('x00280011');
        
        if (!pixelDataElement || !rows || !cols || rows < 10 || cols < 10) {
          continue;
        }

        let relativePath = path.relative(baseDir, filePath);
        relativePath = relativePath.replace(/\\/g, '/');
        results.push(relativePath);
      } catch (err) {
        // Omite silenciosamente archivos no DICOM o corruptos
        continue;
      }
    }
  }
  return results;
};

/**
 * Servicio para servir archivos DICOM verificando la ruta física.
 */
const listDicomFiles = async (req, res) => {
  try {
    const { studyId } = req.params;
    const study = await dicomService.getStudyById(studyId);

    if (!study) {
      return res.status(404).json({ error: 'Estudio no encontrado.' });
    }

    const dirPath = path.resolve(study.directoryPath);

    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'El directorio físico no está disponible.' });
    }

    const dicomFiles = getDicomFilesRecursive(dirPath, dirPath);
    
    // Ordenar los archivos (por nombre de archivo, idealmente numérico si tienen un patrón)
    dicomFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    res.json({ files: dicomFiles });
  } catch (error) {
    console.error('Error en listDicomFiles:', error);
    res.status(500).json({ error: 'Error interno.' });
  }
};

const serveDicom = async (req, res) => {
  try {
    const { studyId, filename } = req.params;
    
    // Obtenemos el estudio validando que exista
    const study = await dicomService.getStudyWithPatient(studyId);

    if (!study) {
      return res.status(404).send('Estudio no encontrado.');
    }

    // Comprobamos la existencia física del archivo dentro del directorio
    const dicomFilePath = path.resolve(study.directoryPath, filename);
    
    if (!fs.existsSync(dicomFilePath)) {
      console.error(`Archivo físico no encontrado: ${dicomFilePath}`);
      return res.status(404).send('El archivo físico del DICOM no está disponible.');
    }

    // Enviamos el archivo
    // NOTA: Con esto evitamos servir archivos en carpetas públicas
    res.download(dicomFilePath, path.basename(filename), (err) => {
      if (err) {
        console.error('Error enviando el archivo:', err);
        if (!res.headersSent) {
          res.status(500).send('Error durante la descarga.');
        }
      }
    });

  } catch (error) {
    console.error('Error en serveDicom:', error);
    res.status(500).send('Error interno del servidor.');
  }
};

/**
 * Renderiza la vista de Cornerstone.js para visualización.
 */
const viewDicom = async (req, res) => {
  try {
    const { studyId } = req.params;
    
    // Validar existencia de estudio
    const study = await dicomService.getStudyById(studyId);
    if (!study) {
      return res.status(404).send('Estudio no encontrado.');
    }

    // Aquí pasamos el studyId a la vista. El visor en frontend usará cornerstone.js 
    // conectándose a la ruta de descarga para obtener la matriz del visualizador.
    res.render('viewer', { studyId: study.id, title: 'Visualizador DICOM' });
  } catch (error) {
    console.error('Error en viewDicom:', error);
    res.status(500).send('Error interno.');
  }
};

const downloadStudy = async (req, res) => {
  try {
    const { studyId } = req.params;
    const study = await dicomService.getStudyById(studyId);

    if (!study) {
      return res.status(404).send('Estudio no encontrado.');
    }

    const dirPath = path.resolve(study.directoryPath);

    if (!fs.existsSync(dirPath)) {
      console.error(`Directorio no encontrado: ${dirPath}`);
      return res.status(404).send('El directorio físico del estudio no está disponible.');
    }

    // Configurar cabeceras de respuesta para descarga de archivo ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=estudio_${studyId}.zip`);

    // Crear el archivador con archiver v8.0.0 (Fast stream level 4)
    const archive = new ZipArchive({ zlib: { level: 4 } });

    archive.on('error', (err) => {
      console.error('Error durante la compresión del ZIP:', err);
      if (!res.headersSent) {
        res.status(500).send('Error durante la descarga.');
      }
    });

    archive.pipe(res);

    // Añadir todos los archivos DICOM del directorio al ZIP
    archive.directory(dirPath, false);

    // Finalizar el archivo (comenzará a enviarse al cliente)
    await archive.finalize();

  } catch (error) {
    console.error('Error en downloadStudy:', error);
    if (!res.headersSent) {
      res.status(500).send('Error interno del servidor.');
    }
  }
};

const downloadStudyJpg = async (req, res) => {
  try {
    const { studyId } = req.params;
    const study = await dicomService.getStudyById(studyId);

    if (!study) {
      return res.status(404).send('Estudio no encontrado.');
    }

    const dirPath = path.resolve(study.directoryPath);

    if (!fs.existsSync(dirPath)) {
      console.error(`Directorio no encontrado: ${dirPath}`);
      return res.status(404).send('El directorio físico del estudio no está disponible.');
    }

    const dicomFiles = getDicomFilesRecursive(dirPath, dirPath);

    if (dicomFiles.length === 0) {
      return res.status(404).send('No se encontraron archivos DICOM en el estudio.');
    }

    // Configurar cabeceras de respuesta para descarga de archivo ZIP con JPGs
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=estudio_${studyId}_jpg.zip`);

    const archive = new ZipArchive({ zlib: { level: 4 } });

    archive.on('error', (err) => {
      console.error('Error durante la compresión del ZIP de JPGs:', err);
      if (!res.headersSent) {
        res.status(500).send('Error durante la descarga.');
      }
    });

    archive.pipe(res);

    // Convertir archivos DICOM a JPG en paralelo (lotes concurrentes de 4 a 8 procesamientos)
    const CONCURRENCY_LIMIT = 4;
    for (let i = 0; i < dicomFiles.length; i += CONCURRENCY_LIMIT) {
      const chunk = dicomFiles.slice(i, i + CONCURRENCY_LIMIT);
      const convertedChunk = await Promise.all(
        chunk.map(async (relPath) => {
          const fullPath = path.join(dirPath, relPath);
          try {
            const jpgBuffer = await convertDicomToJpgBuffer(fullPath);
            let jpgFileName = relPath.replace(/\.(dcm|dicom|ima|img)$/i, '');
            if (!jpgFileName.toLowerCase().endsWith('.jpg')) {
              jpgFileName += '.jpg';
            }
            return { jpgBuffer, jpgFileName };
          } catch (err) {
            console.error(`Error convirtiendo archivo ${fullPath} a JPG:`, err);
            return null;
          }
        })
      );

      for (const item of convertedChunk) {
        if (item && item.jpgBuffer) {
          archive.append(item.jpgBuffer, { name: item.jpgFileName });
        }
      }
    }

    await archive.finalize();

  } catch (error) {
    console.error('Error en downloadStudyJpg:', error);
    if (!res.headersSent) {
      res.status(500).send('Error interno del servidor.');
    }
  }
};

export {
  serveDicom,
  viewDicom,
  listDicomFiles,
  downloadStudy,
  downloadStudyJpg
};
