// backend-nodejs/routes/projects-details.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configuration multer pour les uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/projects', req.params.projectId);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

// Middleware pour permissions
const canManageProject = async (req, res, next) => {
  try {
    const user = req.user.fullUser;
    const projectId = req.params.projectId;
    
    // Admin et PMO peuvent tout faire
    if (['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
      return next();
    }
    
    // Chef de projet peut gérer ses projets
    if (user.role_nom === 'Chef de Projet') {
      const [project] = await query('SELECT chef_projet_id FROM projets WHERE id = ?', [projectId]);
      if (project && project.chef_projet_id === req.user.userId) {
        return next();
      }
    }
    
    return res.status(403).json({
      success: false,
      message: 'Permission insuffisante pour gérer ce projet'
    });
  } catch (error) {
    console.error('Erreur vérification permissions:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// GET /api/projects/:projectId/details - Récupérer tous les détails d'un projet
router.get('/:projectId/details', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`🔍 Récupération détails projet ${projectId}`);
    
    // Informations du projet
    const [projet] = await query(`
      SELECT 
        p.*, u.nom as chef_projet_nom, u.email as chef_projet_email,
        d.nom as direction_nom, s.nom as statut_nom, s.couleur as statut_couleur
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE p.id = ?
    `, [projectId]);

    if (!projet) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    // Phases
    const phases = await query(`
      SELECT 
        ph.*, u.nom as responsable_nom,
        COUNT(l.id) as nb_livrables
      FROM phases_projet ph
      LEFT JOIN utilisateurs u ON ph.responsable_id = u.id
      LEFT JOIN livrables l ON ph.id = l.phase_id
      WHERE ph.projet_id = ?
      GROUP BY ph.id
      ORDER BY ph.ordre
    `, [projectId]);

    // Livrables
    const livrables = await query(`
      SELECT 
        l.*, ph.nom as phase_nom, u1.nom as responsable_nom, u2.nom as validateur_nom
      FROM livrables l
      LEFT JOIN phases_projet ph ON l.phase_id = ph.id
      LEFT JOIN utilisateurs u1 ON l.responsable_id = u1.id
      LEFT JOIN utilisateurs u2 ON l.validateur_id = u2.id
      WHERE l.projet_id = ?
      ORDER BY l.date_prevue
    `, [projectId]);

    // Contrats
    const contrats = await query(`
      SELECT 
        c.*, pr.nom as prestataire_nom, u.nom as created_by_nom
      FROM contrats c
      LEFT JOIN prestataires pr ON c.prestataire_id = pr.id
      LEFT JOIN utilisateurs u ON c.created_by = u.id
      WHERE c.projet_id = ?
      ORDER BY c.created_at
    `, [projectId]);

    // Documents
    const documents = await query(`
      SELECT 
        d.*, ph.nom as phase_nom, l.nom as livrable_nom, 
        c.intitule as contrat_intitule, u.nom as uploaded_by_nom
      FROM documents_projet d
      LEFT JOIN phases_projet ph ON d.phase_id = ph.id
      LEFT JOIN livrables l ON d.livrable_id = l.id
      LEFT JOIN contrats c ON d.contrat_id = c.id
      LEFT JOIN utilisateurs u ON d.uploaded_by = u.id
      WHERE d.projet_id = ?
      ORDER BY d.uploaded_at DESC
    `, [projectId]);

    // Prestataires associés
    const prestataires = await query(`
      SELECT 
        pp.*, pr.nom as prestataire_nom, pr.contact_email, pr.contact_telephone
      FROM projet_prestataires pp
      JOIN prestataires pr ON pp.prestataire_id = pr.id
      WHERE pp.projet_id = ?
    `, [projectId]);

    // Détails budgétaires
    const budgetDetails = await query(`
      SELECT 
        bd.*, ph.nom as phase_nom, c.intitule as contrat_intitule
      FROM budget_details bd
      LEFT JOIN phases_projet ph ON bd.phase_id = ph.id
      LEFT JOIN contrats c ON bd.contrat_id = c.id
      WHERE bd.projet_id = ?
      ORDER BY bd.created_at DESC
    `, [projectId]);

    console.log(`✅ Détails projet ${projectId} récupérés: ${phases.length} phases, ${livrables.length} livrables, ${contrats.length} contrats`);

    res.json({
      success: true,
      data: {
        projet,
        phases,
        livrables,
        contrats,
        documents,
        prestataires,
        budgetDetails
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération détails projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails du projet'
    });
  }
});

// POST /api/projects/:projectId/phases - Créer une phase
router.post('/:projectId/phases', authenticateToken, canManageProject, async (req, res) => {
  try {
    const { projectId } = req.params;
    const phaseData = req.body;
    
    console.log(`🆕 Création phase pour projet ${projectId}:`, phaseData);
    
    // Calculer l'ordre automatiquement
    const [maxOrdre] = await query(
      'SELECT COALESCE(MAX(ordre), 0) + 1 as next_ordre FROM phases_projet WHERE projet_id = ?', 
      [projectId]
    );
    
    const sql = `
      INSERT INTO phases_projet (
        projet_id, nom, description, date_debut, date_fin_prevue, 
        budget_alloue, responsable_id, ordre, statut, pourcentage_avancement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Planifiée', 0)
    `;
    
    const values = [
      projectId,
      phaseData.nom,
      phaseData.description,
      phaseData.date_debut || null,
      phaseData.date_fin_prevue || null,
      phaseData.budget_alloue || null,
      phaseData.responsable_id || null,
      maxOrdre.next_ordre
    ];
    
    const result = await query(sql, values);
    
    console.log(`✅ Phase créée avec ID ${result.insertId}`);
    
    res.json({
      success: true,
      message: 'Phase créée avec succès',
      data: { id: result.insertId, ...phaseData }
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
router.put('/phases/:phaseId', authenticateToken, async (req, res) => {
  try {
    const { phaseId } = req.params;
    const phaseData = req.body;
    
    console.log(`🔄 Mise à jour phase ${phaseId}:`, phaseData);
    
    const fields = [];
    const values = [];
    
    Object.keys(phaseData).forEach(key => {
      if (phaseData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(phaseData[key]);
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }
    
    values.push(phaseId);
    const sql = `UPDATE phases_projet SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const result = await query(sql, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Phase non trouvée'
      });
    }
    
    console.log(`✅ Phase ${phaseId} mise à jour`);
    
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
router.delete('/phases/:phaseId', authenticateToken, async (req, res) => {
  try {
    const { phaseId } = req.params;
    
    console.log(`🗑️ Suppression phase ${phaseId}`);
    
    const result = await query('DELETE FROM phases_projet WHERE id = ?', [phaseId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Phase non trouvée'
      });
    }
    
    console.log(`✅ Phase ${phaseId} supprimée`);
    
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

// POST /api/projects/:projectId/livrables - Créer un livrable
router.post('/:projectId/livrables', authenticateToken, canManageProject, async (req, res) => {
  try {
    const { projectId } = req.params;
    const livrableData = req.body;
    
    console.log(`🆕 Création livrable pour projet ${projectId}:`, livrableData);
    
    const sql = `
      INSERT INTO livrables (
        projet_id, phase_id, nom, description, type_livrable,
        date_prevue, responsable_id, statut, poids_projet
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Planifié', ?)
    `;
    
    const values = [
      projectId,
      livrableData.phase_id || null,
      livrableData.nom,
      livrableData.description,
      livrableData.type_livrable || 'Document',
      livrableData.date_prevue || null,
      livrableData.responsable_id || null,
      livrableData.poids_projet || 0
    ];
    
    const result = await query(sql, values);
    
    console.log(`✅ Livrable créé avec ID ${result.insertId}`);
    
    res.json({
      success: true,
      message: 'Livrable créé avec succès',
      data: { id: result.insertId, ...livrableData }
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
router.put('/livrables/:livrableId', authenticateToken, async (req, res) => {
  try {
    const { livrableId } = req.params;
    const livrableData = req.body;
    
    console.log(`🔄 Mise à jour livrable ${livrableId}:`, livrableData);
    
    const fields = [];
    const values = [];
    
    Object.keys(livrableData).forEach(key => {
      if (livrableData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(livrableData[key]);
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }
    
    values.push(livrableId);
    const sql = `UPDATE livrables SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const result = await query(sql, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Livrable non trouvé'
      });
    }
    
    console.log(`✅ Livrable ${livrableId} mis à jour`);
    
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

// DELETE /api/livrables/:livrableId - Supprimer un livrable
router.delete('/livrables/:livrableId', authenticateToken, async (req, res) => {
  try {
    const { livrableId } = req.params;
    
    console.log(`🗑️ Suppression livrable ${livrableId}`);
    
    const result = await query('DELETE FROM livrables WHERE id = ?', [livrableId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Livrable non trouvé'
      });
    }
    
    console.log(`✅ Livrable ${livrableId} supprimé`);
    
    res.json({
      success: true,
      message: 'Livrable supprimé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression livrable:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du livrable'
    });
  }
});

// POST /api/projects/:projectId/prestataires - Associer un prestataire
router.post('/:projectId/prestataires', authenticateToken, canManageProject, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { prestataire_id, role_prestataire, date_debut, date_fin } = req.body;
    
    console.log(`🆕 Association prestataire ${prestataire_id} au projet ${projectId}`);
    
    const sql = `
      INSERT INTO projet_prestataires (
        projet_id, prestataire_id, role_prestataire, date_debut, date_fin, statut
      ) VALUES (?, ?, ?, ?, ?, 'Actif')
    `;
    
    const values = [projectId, prestataire_id, role_prestataire, date_debut || null, date_fin || null];
    const result = await query(sql, values);
    
    console.log(`✅ Prestataire associé avec ID ${result.insertId}`);
    
    res.json({
      success: true,
      message: 'Prestataire associé avec succès',
      data: { id: result.insertId }
    });
    
  } catch (error) {
    console.error('❌ Erreur association prestataire:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ce prestataire est déjà associé à ce projet'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'association du prestataire'
    });
  }
});

// DELETE /api/projects/:projectId/prestataires/:prestataireId - Dissocier un prestataire
router.delete('/:projectId/prestataires/:prestataireId', authenticateToken, canManageProject, async (req, res) => {
  try {
    const { projectId, prestataireId } = req.params;
    
    console.log(`🗑️ Dissociation prestataire ${prestataireId} du projet ${projectId}`);
    
    const result = await query(
      'DELETE FROM projet_prestataires WHERE projet_id = ? AND prestataire_id = ?', 
      [projectId, prestataireId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Association prestataire non trouvée'
      });
    }
    
    console.log(`✅ Prestataire ${prestataireId} dissocié du projet ${projectId}`);
    
    res.json({
      success: true,
      message: 'Prestataire dissocié avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur dissociation prestataire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la dissociation du prestataire'
    });
  }
});

// PUT /api/projects/:projectId/budget - Mettre à jour le budget
router.put('/:projectId/budget', authenticateToken, canManageProject, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { budget_details } = req.body;
    
    console.log(`🔄 Mise à jour budget projet ${projectId}`);
    
    // Supprimer les anciens détails budgétaires
    await query('DELETE FROM budget_details WHERE projet_id = ?', [projectId]);
    
    // Insérer les nouveaux détails
    for (const detail of budget_details) {
      const sql = `
        INSERT INTO budget_details (
          projet_id, phase_id, contrat_id, categorie, montant_prevu, 
          montant_engage, montant_facture, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        projectId,
        detail.phase_id || null,
        detail.contrat_id || null,
        detail.categorie,
        detail.montant_prevu,
        detail.montant_engage || 0,
        detail.montant_facture || 0,
        detail.description
      ];
      
      await query(sql, values);
    }
    
    console.log(`✅ Budget projet ${projectId} mis à jour`);
    
    res.json({
      success: true,
      message: 'Budget mis à jour avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur mise à jour budget:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du budget'
    });
  }
});

// POST /api/projects/:projectId/documents - Upload de document
router.post('/:projectId/documents', authenticateToken, canManageProject, upload.single('document'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { phase_id, livrable_id, contrat_id, categorie, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }
    
    console.log(`📁 Upload document pour projet ${projectId}: ${req.file.originalname}`);
    
    const documentData = {
      projet_id: projectId,
      phase_id: phase_id || null,
      livrable_id: livrable_id || null,
      contrat_id: contrat_id || null,
      nom_fichier: req.file.filename,
      nom_original: req.file.originalname,
      chemin_fichier: req.file.path,
      taille_fichier: req.file.size,
      type_mime: req.file.mimetype,
      categorie: categorie || 'Autre',
      description: description,
      uploaded_by: req.user.userId
    };
    
    const sql = `
      INSERT INTO documents_projet (
        projet_id, phase_id, livrable_id, contrat_id, nom_fichier, nom_original,
        chemin_fichier, taille_fichier, type_mime, categorie, description, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      documentData.projet_id,
      documentData.phase_id,
      documentData.livrable_id,
      documentData.contrat_id,
      documentData.nom_fichier,
      documentData.nom_original,
      documentData.chemin_fichier,
      documentData.taille_fichier,
      documentData.type_mime,
      documentData.categorie,
      documentData.description,
      documentData.uploaded_by
    ];
    
    const result = await query(sql, values);
    
    console.log(`✅ Document uploadé avec ID ${result.insertId}`);
    
    res.json({
      success: true,
      message: 'Document uploadé avec succès',
      data: { id: result.insertId, ...documentData }
    });
    
  } catch (error) {
    console.error('❌ Erreur upload document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du document'
    });
  }
});

// GET /api/projects/:projectId/documents/:documentId/download - Télécharger un document
router.get('/:projectId/documents/:documentId/download', authenticateToken, async (req, res) => {
  try {
    const { projectId, documentId } = req.params;
    
    const [document] = await query(`
      SELECT * FROM documents_projet 
      WHERE id = ? AND projet_id = ?
    `, [documentId, projectId]);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }
    
    console.log(`📥 Téléchargement document ${document.nom_original}`);
    
    const filePath = document.chemin_fichier;
    res.download(filePath, document.nom_original);
    
  } catch (error) {
    console.error('❌ Erreur téléchargement document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement'
    });
  }
});

// DELETE /api/documents/:documentId - Supprimer un document
router.delete('/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Récupérer les infos du document pour supprimer le fichier
    const [document] = await query('SELECT * FROM documents_projet WHERE id = ?', [documentId]);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }
    
    console.log(`🗑️ Suppression document ${document.nom_original}`);
    
    // Supprimer de la base de données
    await query('DELETE FROM documents_projet WHERE id = ?', [documentId]);
    
    // Supprimer le fichier physique
    try {
      await fs.unlink(document.chemin_fichier);
    } catch (fileError) {
      console.warn('⚠️ Impossible de supprimer le fichier physique:', fileError.message);
    }
    
    console.log(`✅ Document ${documentId} supprimé`);
    
    res.json({
      success: true,
      message: 'Document supprimé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du document'
    });
  }
});

module.exports = router;