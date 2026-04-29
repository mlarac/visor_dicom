import { Study, Patient, AuditLog } from '../models/index.js';
import path from 'path';
import fs from 'fs';

/**
 * Servicio para servir archivos DICOM verificando la ruta física
 */
const downloadDicom = async (req, res) => {
  try {
    const { studyId } = req.params;
    
    // Obtenemos el estudio validando que exista
    const study = await Study.findByPk(studyId, {
      include: [Patient]
    });

    if (!study) {
      return res.status(404).send('Estudio no encontrado.');
    }

    // Comprobamos la existencia física del archivo
    const dicomFilePath = path.resolve(study.filePath);
    
    if (!fs.existsSync(dicomFilePath)) {
      console.error(`Archivo físico no encontrado: ${dicomFilePath}`);
      return res.status(404).send('El archivo físico del DICOM no está disponible.');
    }

    // Enviamos el archivo
    // NOTA: Con esto evitamos servir archivos en carpetas públicas
    res.download(dicomFilePath, `study_${studyId}.dcm`, (err) => {
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
 * Renderiza la vista de Cornerstone.js para visualización
 */
const viewDicom = async (req, res) => {
  try {
    const { studyId } = req.params;
    
    // Validar existencia de estudio y permisos (la sesión la maneja un middleware general)
    const study = await Study.findByPk(studyId);
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
  viewDicom
};
