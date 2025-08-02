// backend-nodejs/models/Document.js
const { query } = require('../config/database');

class Document {
  // Créer un nouveau document
  static async create(documentData) {
    try {
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
        documentData.categorie || 'Autre',
        documentData.description,
        documentData.uploaded_by
      ];

      const result = await query(sql, values);
      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur Document.create:', error);
      throw error;
    }
  }

  // Récupérer les documents d'un projet
  static async findByProject(projectId) {
    try {
      const sql = `
        SELECT 
          d.*,
          p.nom as phase_nom,
          l.nom as livrable_nom,
          c.intitule as contrat_intitule,
          u.nom as uploaded_by_nom
        FROM documents_projet d
        LEFT JOIN phases_projet p ON d.phase_id = p.id
        LEFT JOIN livrables l ON d.livrable_id = l.id
        LEFT JOIN contrats c ON d.contrat_id = c.id
        LEFT JOIN utilisateurs u ON d.uploaded_by = u.id
        WHERE d.projet_id = ?
        ORDER BY d.uploaded_at DESC
      `;
      
      return await query(sql, [projectId]);
    } catch (error) {
      console.error('❌ Erreur Document.findByProject:', error);
      throw error;
    }
  }

  // Récupérer un document par ID
  static async findById(id) {
    try {
      const sql = `
        SELECT 
          d.*,
          p.nom as phase_nom,
          l.nom as livrable_nom,
          c.intitule as contrat_intitule,
          u.nom as uploaded_by_nom
        FROM documents_projet d
        LEFT JOIN phases_projet p ON d.phase_id = p.id
        LEFT JOIN livrables l ON d.livrable_id = l.id
        LEFT JOIN contrats c ON d.contrat_id = c.id
        LEFT JOIN utilisateurs u ON d.uploaded_by = u.id
        WHERE d.id = ?
      `;
      
      const results = await query(sql, [id]);
      return results[0] || null;
    } catch (error) {
      console.error('❌ Erreur Document.findById:', error);
      throw error;
    }
  }

  // Supprimer un document
  static async delete(id) {
    try {
      const sql = 'DELETE FROM documents_projet WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Document.delete:', error);
      throw error;
    }
  }
}

module.exports = Document;