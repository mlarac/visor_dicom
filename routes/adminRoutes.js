import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { isAuthenticated, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Todas las rutas de administración requieren autenticación y rol de administrador
router.use(isAuthenticated, isAdmin);

router.get('/users', adminController.getUsers);
router.get('/users/create', adminController.getCreateUserForm);
router.post('/users/create', adminController.createUser);
router.post('/users/delete/:userId', adminController.deleteUser);
router.get('/users/audit/:userId', adminController.getUserAudit);

export default router;
