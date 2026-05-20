import * as dicomService from '../services/dicomService.js';
import path from 'path';
import fs from 'fs';

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

    fs.readdir(dirPath, (err, files) => {
      if (err) {
        console.error('Error leyendo directorio:', err);
        return res.status(500).json({ error: 'Error al listar los archivos.' });
      }

      // Filtrar solo archivos con una cierta extensión si se desea, o todos.
      // Suponemos que la carpeta solo tiene archivos DICOM.
      const dicomFiles = files.filter(f => fs.lstatSync(path.join(dirPath, f)).isFile());
      
      // Ordenar los archivos (por nombre de archivo, idealmente numérico si tienen un patrón)
      dicomFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      res.json({ files: dicomFiles });
    });
  } catch (error) {
    console.error('Error en listDicomFiles:', error);
    res.status(500).json({ error: 'Error interno.' });
  }
};

const downloadDicom = async (req, res) => {
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
    res.download(dicomFilePath, filename, (err) => {
      if (err) {
        console.error('Error enviando el archivo:', err);
        if (!res.headersSent) {
          res.status(500).send('Error durante la descarga.');
        }
      }
    });

  } catch (error) {
    console.error('Error en downloadDicom:', error);
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

export {
  downloadDicom,
  viewDicom,
  listDicomFiles
};
