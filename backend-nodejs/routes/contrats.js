// backend-nodejs/routes/contrats.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

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
      const [project] = await query('SELECT chef_projet_id FROM projets WHERE id = ?', [projectId]);
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
    console.log(`🔍 Récupération contrats projet ${projectId}`);
    
    const contrats = await query(`
      SELECT 
        c.*, pr.nom as prestataire_nom, pr.contact_email, pr.contact_telephone,
        u.nom as created_by_nom
      FROM contrats c
      LEFT JOIN prestataires pr ON c.prestataire_id = pr.id
      LEFT JOIN utilisateurs u ON c.created_by = u.id
      WHERE c.projet_id = ?
      ORDER BY c.created_at DESC
    `, [projectId]);
    
    console.log(`✅ ${contrats.length} contrats récupérés`);
    
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
    
    console.log(`🆕 Création contrat pour projet ${projectId}:`, contratData);
    
    const sql = `
      INSERT INTO contrats (
        projet_id, numero_contrat, intitule, prestataire_id, montant,
        date_debut, date_fin, statut, description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      projectId,
      contratData.numero_contrat,
      contratData.intitule,
      contratData.prestataire_id || null,
      contratData.montant || null,
      contratData.date_debut || null,
      contratData.date_fin || null,
      contratData.statut || 'Planifié',
      contratData.description || null,
      req.user.userId
    ];
    
    const result = await query(sql, values);
    
    // Récupérer le contrat créé avec les informations liées
    const [newContrat] = await query(`
      SELECT 
        c.*, pr.nom as prestataire_nom, u.nom as created_by_nom
      FROM contrats c
      LEFT JOIN prestataires pr ON c.prestataire_id = pr.id
      LEFT JOIN utilisateurs u ON c.created_by = u.id
      WHERE c.id = ?
    `, [result.insertId]);
    
    console.log(`✅ Contrat créé avec ID ${result.insertId}`);
    
    res.json({
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
router.put('/contrats/:contratId', authenticateToken, async (req, res) => {
  try {
    const { contratId } = req.params;
    const contratData = req.body;
    
    console.log(`🔄 Mise à jour contrat ${contratId}:`, contratData);
    
    const fields = [];
    const values = [];
    
    Object.keys(contratData).forEach(key => {
      if (contratData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(contratData[key]);
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }
    
    values.push(contratId);
    const sql = `UPDATE contrats SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const result = await query(sql, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contrat non trouvé'
      });
    }
    
    console.log(`✅ Contrat ${contratId} mis à jour`);
    
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

// DELETE /api/contrats/:contratId - Supprimer un contrat
router.delete('/contrats/:contratId', authenticateToken, async (req, res) => {
  try {
    const { contratId } = req.params;
    
    console.log(`🗑️ Suppression contrat ${contratId}`);
    
    const result = await query('DELETE FROM contrats WHERE id = ?', [contratId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contrat non trouvé'
      });
    }
    
    console.log(`✅ Contrat ${contratId} supprimé`);
    
    res.json({
      success: true,
      message: 'Contrat supprimé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression contrat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du contrat'
    });
  }
});

// GET /api/prestataires - Récupérer tous les prestataires pour les sélections
router.get('/prestataires', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Récupération liste prestataires');
    
    const prestataires = await query(`
      SELECT id, nom, contact_email, contact_telephone, specialite
      FROM prestataires
      WHERE statut = 'Actif'
      ORDER BY nom
    `);
    
    console.log(`✅ ${prestataires.length} prestataires récupérés`);
    
    res.json({
      success: true,
      data: prestataires
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération prestataires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des prestataires'
    });
  }
});

module.exports = router;