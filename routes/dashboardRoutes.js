import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', isAuthenticated, dashboardController.getDashboard);

export default router;
