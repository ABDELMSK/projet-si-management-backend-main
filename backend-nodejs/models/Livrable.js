// backend-nodejs/models/Livrable.js
const { query } = require('../config/database');

class Livrable {
  // Créer un nouveau livrable
  static async create(livrableData) {
    try {
      const sql = `
        INSERT INTO livrables (
          projet_id, phase_id, contrat_id, nom, description, type_livrable,
          date_prevue, statut, responsable_id, poids_projet
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        livrableData.projet_id,
        livrableData.phase_id,
        livrableData.contrat_id,
        livrableData.nom,
        livrableData.description,
        livrableData.type_livrable || 'Document',
        livrableData.date_prevue,
        livrableData.statut || 'Planifié',
        livrableData.responsable_id,
        livrableData.poids_projet || 0
      ];

      const result = await query(sql, values);
      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur Livrable.create:', error);
      throw error;
    }
  }

  // Récupérer les livrables d'un projet
  static async findByProject(projectId) {
    try {
      const sql = `
        SELECT 
          l.*,
          p.nom as phase_nom,
          c.intitule as contrat_intitule,
          u1.nom as responsable_nom,
          u2.nom as validateur_nom,
          (SELECT COUNT(*) FROM documents_projet WHERE livrable_id = l.id) as nb_documents
        FROM livrables l
        LEFT JOIN phases_projet p ON l.phase_id = p.id
        LEFT JOIN contrats c ON l.contrat_id = c.id
        LEFT JOIN utilisateurs u1 ON l.responsable_id = u1.id
        LEFT JOIN utilisateurs u2 ON l.validateur_id = u2.id
        WHERE l.projet_id = ?
        ORDER BY l.date_prevue ASC, l.created_at ASC
      `;
      
      return await query(sql, [projectId]);
    } catch (error) {
      console.error('❌ Erreur Livrable.findByProject:', error);
      throw error;
    }
  }

  // Mettre à jour un livrable
  static async update(id, livrableData) {
    try {
      const fields = [];
      const values = [];
      
      Object.keys(livrableData).forEach(key => {
        if (livrableData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(livrableData[key]);
        }
      });
      
      if (fields.length === 0) return false;
      
      values.push(id);
      const sql = `UPDATE livrables SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
      
      const result = await query(sql, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Livrable.update:', error);
      throw error;
    }
  }
}

module.exports = Livrable;
