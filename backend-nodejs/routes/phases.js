// backend-nodejs/routes/phases.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Phase = require('../models/Phase');
const Project = require('../models/Project');

// Middleware pour vérifier les permissions sur les phases
const canManagePhases = async (req, res, next) => {
  try {
    const user = req.user.fullUser;
    const projectId = req.params.projectId || req.body.projet_id;
    
    // Admin et PMO peuvent tout faire
    if (['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
      return next();
    }
    
    // Chef de projet peut gérer les phases de ses projets
    if (user.role_nom === 'Chef de Projet') {
      const project = await Project.findById(projectId);
      if (project && project.chef_projet_id === req.user.userId) {
        return next();
      }
    }
    
    return res.status(403).json({
      success: false,
      message: 'Permission insuffisante pour gérer les phases de ce projet'
    });
  } catch (error) {
    console.error('Erreur vérification permissions phases:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/projects/:projectId/phases - Récupérer les phases d'un projet
router.get('/:projectId/phases', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const phases = await Phase.findByProject(projectId);
    
    res.json({
      success: true,
      data: phases,
      count: phases.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération phases:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des phases'
    });
  }
});

// POST /api/projects/:projectId/phases - Créer une nouvelle phase
router.post('/:projectId/phases', authenticateToken, canManagePhases, async (req, res) => {
  try {
    const { projectId } = req.params;
    const phaseData = {
      ...req.body,
      projet_id: projectId
    };
    
    const phaseId = await Phase.create(phaseData);
    const newPhase = await Phase.findByProject(projectId);
    const createdPhase = newPhase.find(p => p.id === phaseId);
    
    res.status(201).json({
      success: true,
      message: 'Phase créée avec succès',
      data: createdPhase
    });
  } catch (error) {
    console.error('❌ Erreur création phase:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la phase'
    });
  }
});

// PUT /api/phases/:phaseId - Mettre à jour une phase
router.put('/:phaseId', authenticateToken, async (req, res) => {
  try {
    const { phaseId } = req.params;
    
    // TODO: Ajouter vérification des permissions basée sur le projet de la phase
    
    const updated = await Phase.update(phaseId, req.body);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Phase non trouvée ou aucune modification'
      });
    }
    
    res.json({
      success: true,
      message: 'Phase mise à jour avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour phase:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la phase'
    });
  }
});

// DELETE /api/phases/:phaseId - Supprimer une phase
router.delete('/:phaseId', authenticateToken, canManagePhases, async (req, res) => {
  try {
    const { phaseId } = req.params;
    
    const deleted = await Phase.delete(phaseId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Phase non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Phase supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur suppression phase:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la phase'
    });
  }
});

module.exports = router;





