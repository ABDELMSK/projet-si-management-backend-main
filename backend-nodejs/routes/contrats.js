// backend-nodejs/routes/contrats.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Contrat = require('../models/Contrat');
const Project = require('../models/Project');

// Middleware pour permissions contrats
const canManageContrats = async (req, res, next) => {
  try {
    const user = req.user.fullUser;
    const projectId = req.params.projectId || req.body.projet_id;
    
    // Admin et PMO peuvent tout faire
    if (['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
      return next();
    }
    
    // Chef de projet peut gérer les contrats de ses projets
    if (user.role_nom === 'Chef de Projet') {
      const project = await Project.findById(projectId);
      if (project && project.chef_projet_id === req.user.userId) {
        return next();
      }
    }
    
    return res.status(403).json({
      success: false,
      message: 'Permission insuffisante pour gérer les contrats de ce projet'
    });
  } catch (error) {
    console.error('Erreur vérification permissions contrats:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/projects/:projectId/contrats - Récupérer les contrats d'un projet
router.get('/:projectId/contrats', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const contrats = await Contrat.findByProject(projectId);
    
    res.json({
      success: true,
      data: contrats,
      count: contrats.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération contrats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des contrats'
    });
  }
});

// POST /api/projects/:projectId/contrats - Créer un nouveau contrat
router.post('/:projectId/contrats', authenticateToken, canManageContrats, async (req, res) => {
  try {
    const { projectId } = req.params;
    const contratData = {
      ...req.body,
      projet_id: projectId,
      created_by: req.user.userId
    };
    
    const contratId = await Contrat.create(contratData);
    const contrats = await Contrat.findByProject(projectId);
    const newContrat = contrats.find(c => c.id === contratId);
    
    res.status(201).json({
      success: true,
      message: 'Contrat créé avec succès',
      data: newContrat
    });
  } catch (error) {
    console.error('❌ Erreur création contrat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du contrat'
    });
  }
});

// PUT /api/contrats/:contratId - Mettre à jour un contrat
router.put('/:contratId', authenticateToken, async (req, res) => {
  try {
    const { contratId } = req.params;
    
    // TODO: Ajouter vérification des permissions basée sur le projet du contrat
    
    const updated = await Contrat.update(contratId, req.body);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Contrat non trouvé ou aucune modification'
      });
    }
    
    res.json({
      success: true,
      message: 'Contrat mis à jour avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour contrat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du contrat'
    });
  }
});

module.exports = router;