import express from 'express';
import { serveDicom, viewDicom, listDicomFiles, downloadStudy } from '../controllers/dicomController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import auditMiddleware from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Todas las rutas DICOM requieren autenticación
router.use(isAuthenticated);

router.get('/visualizar/:studyId', auditMiddleware('Visualización'), viewDicom);
router.get('/archivos/:studyId', auditMiddleware('Listar Archivos DICOM'), listDicomFiles);
router.get('/archivos/:studyId/:filename', auditMiddleware('Lectura Archivo DICOM'), serveDicom);
router.get('/descargar/:studyId', auditMiddleware('Descarga de Estudio Completo'), downloadStudy);
router.get('/descargar-zip/:studyId', auditMiddleware('Descarga de Estudio Completo'), downloadStudy);

export default router;
