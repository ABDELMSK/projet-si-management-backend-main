// 📁 Emplacement: backend-nodejs/routes/prestataires.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Prestataire = require('../models/Prestataire');

// Middleware pour vérifier les permissions sur les prestataires
const canManagePrestataires = async (req, res, next) => {
  try {
    const user = req.user.fullUser;
    
    // Admin et PMO peuvent tout faire
    if (['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
      return next();
    }
    
    // Chef de projet peut voir les prestataires mais pas les créer/modifier/supprimer
    if (req.method === 'GET' && user.role_nom === 'Chef de Projet') {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'Permission insuffisante pour gérer les prestataires'
    });
  } catch (error) {
    console.error('Erreur vérification permissions prestataires:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/prestataires - Récupérer tous les prestataires
router.get('/', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { statut, type_prestataire, search } = req.query;
    
    console.log('🔍 Récupération des prestataires avec filtres:', { statut, type_prestataire, search });
    
    const filters = {};
    if (statut) filters.statut = statut;
    if (type_prestataire) filters.type_prestataire = type_prestataire;
    if (search) filters.search = search;
    
    const prestataires = await Prestataire.findAll(filters);
    
    res.json({
      success: true,
      data: prestataires,
      count: prestataires.length,
      message: `${prestataires.length} prestataire(s) trouvé(s)`
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
    const prestataireData = {
      ...req.body,
      created_by: req.user.userId
    };
    
    console.log('🔄 Création d\'un nouveau prestataire:', prestataireData);
    
    // Validation des données requises
    if (!prestataireData.nom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom du prestataire est requis'
      });
    }
    
    if (!prestataireData.type_prestataire) {
      return res.status(400).json({
        success: false,
        message: 'Le type de prestataire est requis'
      });
    }
    
    const prestataireId = await Prestataire.create(prestataireData);
    const newPrestataire = await Prestataire.findById(prestataireId);
    
    console.log(`✅ Prestataire créé avec l'ID ${prestataireId}`);
    
    res.status(201).json({
      success: true,
      message: 'Prestataire créé avec succès',
      data: newPrestataire
    });
  } catch (error) {
    console.error('❌ Erreur création prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du prestataire'
    });
  }
});

// PUT /api/prestataires/:prestataireId - Mettre à jour un prestataire
router.put('/:prestataireId', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId } = req.params;
    const updateData = req.body;
    
    console.log(`🔄 Mise à jour du prestataire ${prestataireId}:`, updateData);
    
    const success = await Prestataire.update(prestataireId, updateData);
    
    if (success) {
      console.log(`✅ Prestataire ${prestataireId} mis à jour avec succès`);
      res.json({
        success: true,
        message: 'Prestataire mis à jour avec succès'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Aucune modification effectuée ou prestataire non trouvé'
      });
    }
  } catch (error) {
    console.error('❌ Erreur mise à jour prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du prestataire'
    });
  }
});

// DELETE /api/prestataires/:prestataireId - Supprimer un prestataire
router.delete('/:prestataireId', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId } = req.params;
    
    console.log(`🗑️ Suppression du prestataire ${prestataireId}`);
    
    // Vérifier s'il y a des contrats associés
    const contratsCount = await Prestataire.getContratsCount(prestataireId);
    if (contratsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Impossible de supprimer ce prestataire : ${contratsCount} contrat(s) associé(s)`
      });
    }
    
    const success = await Prestataire.delete(prestataireId);
    
    if (success) {
      console.log(`✅ Prestataire ${prestataireId} supprimé avec succès`);
      res.json({
        success: true,
        message: 'Prestataire supprimé avec succès'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression ou prestataire non trouvé'
      });
    }
  } catch (error) {
    console.error('❌ Erreur suppression prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du prestataire'
    });
  }
});

// GET /api/prestataires/:prestataireId - Récupérer un prestataire par ID
router.get('/:prestataireId', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId } = req.params;
    
    const prestataire = await Prestataire.findById(prestataireId);
    
    if (!prestataire) {
      return res.status(404).json({
        success: false,
        message: 'Prestataire non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: prestataire
    });
  } catch (error) {
    console.error('❌ Erreur récupération prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du prestataire'
    });
  }
});

// PUT /api/prestataires/:prestataireId/status - Changer le statut d'un prestataire
router.put('/:prestataireId/status', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId } = req.params;
    const { statut } = req.body;
    
    console.log(`🔄 Changement de statut du prestataire ${prestataireId} vers ${statut}`);
    
    if (!['Actif', 'Inactif'].includes(statut)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide. Valeurs acceptées: Actif, Inactif'
      });
    }
    
    const success = await Prestataire.update(prestataireId, { statut });
    
    if (success) {
      res.json({
        success: true,
        message: `Statut du prestataire changé vers "${statut}"`
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erreur lors du changement de statut'
      });
    }
  } catch (error) {
    console.error('❌ Erreur changement statut prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut'
    });
  }
});

// GET /api/prestataires/:prestataireId/contrats - Récupérer les contrats d'un prestataire
router.get('/:prestataireId/contrats', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId } = req.params;
    
    console.log(`🔍 Récupération des contrats pour le prestataire ${prestataireId}`);
    
    const contrats = await Prestataire.getContrats(prestataireId);
    
    res.json({
      success: true,
      data: contrats,
      count: contrats.length,
      message: `${contrats.length} contrat(s) trouvé(s)`
    });
  } catch (error) {
    console.error('❌ Erreur récupération contrats prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des contrats'
    });
  }
});

// GET /api/prestataires/:prestataireId/projets - Récupérer les projets d'un prestataire
router.get('/:prestataireId/projets', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId } = req.params;
    
    console.log(`🔍 Récupération des projets pour le prestataire ${prestataireId}`);
    
    const projets = await Prestataire.getProjets(prestataireId);
    
    res.json({
      success: true,
      data: projets,
      count: projets.length,
      message: `${projets.length} projet(s) trouvé(s)`
    });
  } catch (error) {
    console.error('❌ Erreur récupération projets prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des projets'
    });
  }
});

// GET /api/prestataires/statistics - Statistiques générales des prestataires
router.get('/statistics/general', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    console.log('📊 Calcul des statistiques des prestataires');
    
    const stats = await Prestataire.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur statistiques prestataires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul des statistiques'
    });
  }
});

// POST /api/prestataires/:prestataireId/associate/:projectId - Associer un prestataire à un projet
router.post('/:prestataireId/associate/:projectId', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId, projectId } = req.params;
    const { role_prestataire, date_debut, date_fin } = req.body;
    
    console.log(`🔗 Association prestataire ${prestataireId} au projet ${projectId}`);
    
    const associationData = {
      projet_id: projectId,
      prestataire_id: prestataireId,
      role_prestataire,
      date_debut,
      date_fin,
      statut: 'Actif'
    };
    
    const success = await Prestataire.associateToProject(associationData);
    
    if (success) {
      res.json({
        success: true,
        message: 'Prestataire associé au projet avec succès'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de l\'association ou association déjà existante'
      });
    }
  } catch (error) {
    console.error('❌ Erreur association prestataire projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'association'
    });
  }
});

// DELETE /api/prestataires/:prestataireId/dissociate/:projectId - Dissocier un prestataire d'un projet
router.delete('/:prestataireId/dissociate/:projectId', authenticateToken, canManagePrestataires, async (req, res) => {
  try {
    const { prestataireId, projectId } = req.params;
    
    console.log(`🔗 Dissociation prestataire ${prestataireId} du projet ${projectId}`);
    
    const success = await Prestataire.dissociateFromProject(prestataireId, projectId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Prestataire dissocié du projet avec succès'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erreur lors de la dissociation ou association non trouvée'
      });
    }
  } catch (error) {
    console.error('❌ Erreur dissociation prestataire projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la dissociation'
    });
  }
});

// GET /api/prestataires/types - Récupérer les types de prestataires disponibles
router.get('/reference/types', authenticateToken, async (req, res) => {
  try {
    const types = [
      'SSII/ESN',
      'Freelance',
      'Cabinet de conseil',
      'Intégrateur',
      'Fournisseur matériel',
      'Fournisseur logiciel',
      'Organisme de formation',
      'Autre'
    ];
    
    res.json({
      success: true,
      data: types,
      count: types.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération types prestataires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des types'
    });
  }
});

module.exports = router;