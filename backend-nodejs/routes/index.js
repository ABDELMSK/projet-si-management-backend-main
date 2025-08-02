const express = require('express');
const router = express.Router();

// Routes existantes
const authRoutes = require('./auth');
const userRoutes = require('./users');
const projectRoutes = require('./projects');
const referenceRoutes = require('./reference');

// NOUVELLES ROUTES
const phaseRoutes = require('./phases');
const prestataireRoutes = require('./prestataires');
const contratRoutes = require('./contrats');
const livrableRoutes = require('./livrables');
const documentRoutes = require('./documents');
const reportRoutes = require('./reports');
const dashboardRoutes = require('./dashboard');

// Middleware de logging pour debug
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Route de test de santé
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API fonctionnelle',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    nouvelles_fonctionnalites: [
      'Gestion des phases',
      'Gestion des prestataires', 
      'Gestion des contrats',
      'Gestion des livrables',
      'Gestion documentaire',
      'Rapports avancés',
      'Dashboard PMO'
    ]
  });
});

// Routes existantes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/reference', referenceRoutes);

// NOUVELLES ROUTES
router.use('/projects', phaseRoutes);        // /api/projects/:id/phases
router.use('/prestataires', prestataireRoutes);
router.use('/projects', contratRoutes);      // /api/projects/:id/contrats
router.use('/projects', livrableRoutes);     // /api/projects/:id/livrables
router.use('/projects', documentRoutes);     // /api/projects/:id/documents
router.use('/reports', reportRoutes);        // /api/reports/*
router.use('/dashboard', dashboardRoutes);   // /api/dashboard/*

// Route pour tester les nouvelles fonctionnalités
router.get('/test-features', (req, res) => {
  res.json({
    success: true,
    message: 'Test des nouvelles fonctionnalités',
    routes_disponibles: {
      phases: 'GET/POST /api/projects/:id/phases',
      prestataires: 'GET/POST /api/prestataires',
      contrats: 'GET/POST /api/projects/:id/contrats',
      livrables: 'GET/POST /api/projects/:id/livrables',
      documents: 'GET/POST /api/projects/:id/documents',
      rapports: 'GET /api/reports/*',
      dashboard: 'GET /api/dashboard/*'
    }
  });
});

module.exports = router;
