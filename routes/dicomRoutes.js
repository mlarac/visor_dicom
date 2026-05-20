import express from 'express';
import { downloadDicom, viewDicom, listDicomFiles } from '../controllers/dicomController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import auditMiddleware from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Todas las rutas DICOM requieren autenticación
router.use(isAuthenticated);

router.get('/visualizar/:studyId', auditMiddleware('Visualización'), viewDicom);
router.get('/archivos/:studyId', auditMiddleware('Listar Archivos DICOM'), listDicomFiles);
router.get('/descargar/:studyId/:filename', auditMiddleware('Descarga'), downloadDicom);

export default router;
