// routes/index.js
const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('./auth');
const userRoutes = require('./users');
const projectRoutes = require('./projects');
const referenceRoutes = require('./reference');

// Route de test de l'API
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API fonctionnelle',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Route de test de la base de données
router.get('/test-db', async (req, res) => {
  try {
    const { testConnection, query } = require('../config/database');
    
    const isConnected = await testConnection();
    if (!isConnected) {
      return res.status(500).json({
        success: false,
        message: 'Impossible de se connecter à la base de données'
      });
    }

    const [userCount] = await query('SELECT COUNT(*) as count FROM utilisateurs');
    const [projectCount] = await query('SELECT COUNT(*) as count FROM projets');
    
    res.json({
      success: true,
      message: 'Connexion à la base de données réussie',
      database_connected: true,
      statistics: {
        total_users: userCount.count,
        total_projects: projectCount.count
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur test DB:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test de la base de données',
      error: error.message
    });
  }
});

// Configuration des routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/reference', referenceRoutes);

module.exports = router;