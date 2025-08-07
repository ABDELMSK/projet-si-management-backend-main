
// server.js
const multer = require('multer');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes');
const projectDetailsRoutes = require('./routes/projects-details');
const contratsRoutes = require('./routes/contrats');
// Créer l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Configuration CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middlewares globaux
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging des requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes principales
app.use('/api', routes);

app.use('/api/projects', projectDetailsRoutes);

// Routes pour la gestion des contrats (si pas déjà présent)
app.use('/api', contratsRoutes);
// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'API Gestion de Projets - Backend Node.js',
    version: '1.0.0',
    status: 'En ligne',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      testDb: '/api/test-db',
      auth: {
        login: '/api/auth/login',
        me: '/api/auth/me',
        logout: '/api/auth/logout'
      },
      users: '/api/users',
      projects: {
        list: '/api/projects',
        stats: '/api/projects/stats',
        recent: '/api/projects/recent',
        dashboard: '/api/projects/dashboard'
      },
      reference: {
        directions: '/api/reference/directions',
        roles: '/api/reference/roles',
        projectStatuses: '/api/reference/project-statuses',
        chefsProjets: '/api/reference/users/chefs-projets'
      }
    }
  });
});

// Middleware pour les routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} non trouvée`
  });
});


app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Fichier trop volumineux (maximum 50MB)'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Champ de fichier inattendu'
      });
    }
  }
  
  if (error.message === 'Type de fichier non autorisé') {
    return res.status(400).json({
      success: false,
      message: 'Type de fichier non autorisé'
    });
  }
  
  console.error('Erreur serveur:', error);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur'
  });
});

// Fonction de démarrage du serveur
const startServer = async () => {
  try {
    // Tester la connexion à la base de données
    const fs = require('fs');
const path = require('path');
    console.log('🔌 Test de connexion à la base de données...');
    const { testConnection } = require('./config/database');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.log('⚠️  Base de données non connectée, mais serveur démarré quand même');
    }
    const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Dossier uploads créé');
}

// Créer le sous-dossier projects
const projectsUploadsDir = path.join(uploadsDir, 'projects');
if (!fs.existsSync(projectsUploadsDir)) {
  fs.mkdirSync(projectsUploadsDir, { recursive: true });
  console.log('📁 Dossier uploads/projects créé');
}
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log('='.repeat(70));
      console.log('🚀 SERVEUR BACKEND NODE.JS - GESTION PROJETS & UTILISATEURS');
      console.log('='.repeat(70));
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Base de données: ${dbConnected ? '✅ Connectée' : '❌ Non connectée'}`);
      console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✅ Configuré' : '❌ Manquant'}`);
      console.log(`🔗 CORS: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log('='.repeat(70));
      console.log('📋 Endpoints disponibles:');
      console.log(`   GET  http://localhost:${PORT}/`);
      console.log(`   GET  http://localhost:${PORT}/api/health`);
      console.log(`   GET  http://localhost:${PORT}/api/test-db`);
      console.log('');
      console.log('🔐 Authentification:');
      console.log(`   POST http://localhost:${PORT}/api/auth/login`);
      console.log(`   GET  http://localhost:${PORT}/api/auth/me`);
      console.log(`   POST http://localhost:${PORT}/api/auth/logout`);
      console.log('');
      console.log('👥 Utilisateurs (Admin seulement):');
      console.log(`   GET  http://localhost:${PORT}/api/users`);
      console.log(`   POST http://localhost:${PORT}/api/users`);
      console.log('');
      console.log('📋 Projets (Selon permissions):');
      console.log(`   GET  http://localhost:${PORT}/api/projects`);
      console.log(`   POST http://localhost:${PORT}/api/projects (Admin/PMO)`);
      console.log(`   GET  http://localhost:${PORT}/api/projects/stats`);
      console.log(`   GET  http://localhost:${PORT}/api/projects/dashboard`);
      console.log('');
      console.log('📚 Données de référence:');
      console.log(`   GET  http://localhost:${PORT}/api/reference/directions`);
      console.log(`   GET  http://localhost:${PORT}/api/reference/roles`);
      console.log(`   GET  http://localhost:${PORT}/api/reference/project-statuses`);
      console.log('='.repeat(70));
      console.log('🎯 Comptes de test:');
      console.log('   👨‍💼 admin@entreprise.fr / admin123 (Admin - Tous droits)');
      console.log('   👥 thomas.durand@entreprise.fr / admin123 (PMO - Voir/Créer projets)');
      console.log('   📋 marie.dubois@entreprise.fr / admin123 (Chef - Ses projets seulement)');
      console.log('='.repeat(70));
      console.log('🔥 Serveur prêt à recevoir des requêtes !');
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Gestion propre de l'arrêt du serveur
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

// Démarrer le serveur
startServer();

module.exports = app;