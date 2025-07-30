// routes/auth.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/login - Connexion
router.post('/login', AuthController.login);

// GET /api/auth/me - Récupérer le profil utilisateur
router.get('/me', authenticateToken, AuthController.getMe);

// POST /api/auth/logout - Déconnexion
router.post('/logout', AuthController.logout);

module.exports = router;