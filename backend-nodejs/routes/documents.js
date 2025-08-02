// backend-nodejs/routes/documents.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const Document = require('../models/Document');

// Configuration multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    // Autoriser tous les types de fichiers pour le moment
    cb(null, true);
  }
});

// GET /api/projects/:projectId/documents - Récupérer les documents d'un projet
router.get('/:projectId/documents', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const documents = await Document.findByProject(projectId);
    
    res.json({
      success: true,
      data: documents,
      count: documents.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération documents:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents'
    });
  }
});

// POST /api/projects/:projectId/documents - Upload d'un document
router.post('/:projectId/documents', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }
    
    const documentData = {
      projet_id: projectId,
      phase_id: req.body.phase_id || null,
      livrable_id: req.body.livrable_id || null,
      contrat_id: req.body.contrat_id || null,
      nom_fichier: req.file.filename,
      nom_original: req.file.originalname,
      chemin_fichier: req.file.path,
      taille_fichier: req.file.size,
      type_mime: req.file.mimetype,
      categorie: req.body.categorie || 'Autre',
      description: req.body.description || '',
      uploaded_by: req.user.userId
    };
    
    const documentId = await Document.create(documentData);
    const newDocument = await Document.findById(documentId);
    
    res.status(201).json({
      success: true,
      message: 'Document uploadé avec succès',
      data: newDocument
    });
  } catch (error) {
    console.error('❌ Erreur upload document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du document'
    });
  }
});

// GET /api/documents/:documentId/download - Télécharger un document
router.get('/:documentId/download', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }
    
    if (!fs.existsSync(document.chemin_fichier)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }
    
    res.download(document.chemin_fichier, document.nom_original);
  } catch (error) {
    console.error('❌ Erreur download document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement'
    });
  }
});

// DELETE /api/documents/:documentId - Supprimer un document
router.delete('/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    const document = await Document.findById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }
    
    // Supprimer le fichier physique
    if (fs.existsSync(document.chemin_fichier)) {
      fs.unlinkSync(document.chemin_fichier);
    }
    
    // Supprimer l'enregistrement en base
    const deleted = await Document.delete(documentId);
    
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Échec de la suppression'
      });
    }
    
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