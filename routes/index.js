import express from 'express';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import dicomRoutes from './dicomRoutes.js';
import adminRoutes from './adminRoutes.js';
import userRoutes from './userRoutes.js';

const router = express.Router();

// Registro de las subrutas de la aplicación
router.use('/', authRoutes);
router.use('/', dashboardRoutes);
router.use('/dicom', dicomRoutes);
router.use('/admin', adminRoutes);
router.use('/user', userRoutes);

export default router;
