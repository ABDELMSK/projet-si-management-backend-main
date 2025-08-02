const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Prestataire = require('../models/Prestataire');

// Middleware pour permissions prestataires
const canManagePrestataires = (req, res, next) => {
  const user = req.user.fullUser;
  
  if (['Administrateur fonctionnel', 'PMO / Directeur de projets', 'Chef de Projet'].includes(user.role_nom)) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Permission insuffisante pour gérer les prestataires'
  });
};

// GET /api/prestataires - Récupérer tous les prestataires
router.get('/', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const prestataires = await Prestataire.findAll();
    
    res.json({
      success: true,
      data: prestataires,
      count: prestataires.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération prestataires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des prestataires'
    });
  }
});

// POST /api/prestataires - Créer un nouveau prestataire
router.post('/', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const prestataireId = await Prestataire.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Prestataire créé avec succès',
      data: { id: prestataireId }
    });
  } catch (error) {
    console.error('❌ Erreur création prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du prestataire'
    });
  }
});

// POST /api/projects/:projectId/prestataires/:prestataireId - Associer un prestataire à un projet
router.post('/projects/:projectId/prestataires/:prestataireId', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { projectId, prestataireId } = req.params;
    const { role_prestataire, date_debut } = req.body;
    
    const associated = await Prestataire.associateToProject(projectId, prestataireId, role_prestataire, date_debut);
    
    if (!associated) {
      return res.status(400).json({
        success: false,
        message: 'Échec de l\'association'
      });
    }
    
    res.json({
      success: true,
      message: 'Prestataire associé avec succès au projet'
    });
  } catch (error) {
    console.error('❌ Erreur association prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'association du prestataire'
    });
  }
});

// GET /api/projects/:projectId/prestataires - Récupérer les prestataires d'un projet
router.get('/projects/:projectId/prestataires', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const prestataires = await Prestataire.findByProject(projectId);
    
    res.json({
      success: true,
      data: prestataires,
      count: prestataires.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération prestataires projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des prestataires du projet'
    });
  }
});

module.exports = router;
