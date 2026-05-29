import express from 'express';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// ruta para perfil de usuario autenticado
router.get('/user-profile', isAuthenticated, userController.getProfile);

// ruta para procesar el cambio de contraseña
router.post('/user-profile/change-password', isAuthenticated, userController.updatePassword);

export default router;