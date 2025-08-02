// backend-nodejs/routes/livrables.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Livrable = require('../models/Livrable');
const Project = require('../models/Project');

// Middleware pour permissions livrables
const canManageLivrables = async (req, res, next) => {
  try {
    const user = req.user.fullUser;
    const projectId = req.params.projectId || req.body.projet_id;
    
    // Admin et PMO peuvent tout faire
    if (['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
      return next();
    }
    
    // Chef de projet peut gérer les livrables de ses projets
    if (user.role_nom === 'Chef de Projet') {
      const project = await Project.findById(projectId);
      if (project && project.chef_projet_id === req.user.userId) {
        return next();
      }
    }
    
    return res.status(403).json({
      success: false,
      message: 'Permission insuffisante pour gérer les livrables de ce projet'
    });
  } catch (error) {
    console.error('Erreur vérification permissions livrables:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/projects/:projectId/livrables - Récupérer les livrables d'un projet
router.get('/:projectId/livrables', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const livrables = await Livrable.findByProject(projectId);
    
    res.json({
      success: true,
      data: livrables,
      count: livrables.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération livrables:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des livrables'
    });
  }
});

// POST /api/projects/:projectId/livrables - Créer un nouveau livrable
router.post('/:projectId/livrables', authenticateToken, canManageLivrables, async (req, res) => {
  try {
    const { projectId } = req.params;
    const livrableData = {
      ...req.body,
      projet_id: projectId
    };
    
    const livrableId = await Livrable.create(livrableData);
    const livrables = await Livrable.findByProject(projectId);
    const newLivrable = livrables.find(l => l.id === livrableId);
    
    res.status(201).json({
      success: true,
      message: 'Livrable créé avec succès',
      data: newLivrable
    });
  } catch (error) {
    console.error('❌ Erreur création livrable:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du livrable'
    });
  }
});

// PUT /api/livrables/:livrableId - Mettre à jour un livrable
router.put('/:livrableId', authenticateToken, async (req, res) => {
  try {
    const { livrableId } = req.params;
    
    // TODO: Ajouter vérification des permissions basée sur le projet du livrable
    
    const updated = await Livrable.update(livrableId, req.body);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Livrable non trouvé ou aucune modification'
      });
    }
    
    res.json({
      success: true,
      message: 'Livrable mis à jour avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour livrable:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du livrable'
    });
  }
});

module.exports = router;