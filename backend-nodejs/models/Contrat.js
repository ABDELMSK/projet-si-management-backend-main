// backend-nodejs/models/Contrat.js
const { query } = require('../config/database');

class Contrat {
  // Créer un nouveau contrat
  static async create(contratData) {
    try {
      const sql = `
        INSERT INTO contrats (
          projet_id, numero_contrat, intitule, prestataire_id, montant,
          date_signature, date_debut, date_fin, statut, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        contratData.projet_id,
        contratData.numero_contrat,
        contratData.intitule,
        contratData.prestataire_id,
        contratData.montant,
        contratData.date_signature,
        contratData.date_debut,
        contratData.date_fin,
        contratData.statut || 'En négociation',
        contratData.created_by
      ];

      const result = await query(sql, values);
      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur Contrat.create:', error);
      throw error;
    }
  }

  // Récupérer les contrats d'un projet
  static async findByProject(projectId) {
    try {
      const sql = `
        SELECT 
          c.*,
          p.nom as prestataire_nom,
          p.contact_nom,
          u.nom as created_by_nom
        FROM contrats c
        LEFT JOIN prestataires p ON c.prestataire_id = p.id
        LEFT JOIN utilisateurs u ON c.created_by = u.id
        WHERE c.projet_id = ?
        ORDER BY c.created_at DESC
      `;
      
      return await query(sql, [projectId]);
    } catch (error) {
      console.error('❌ Erreur Contrat.findByProject:', error);
      throw error;
    }
  }

  // Mettre à jour un contrat
  static async update(id, contratData) {
    try {
      const fields = [];
      const values = [];
      
      Object.keys(contratData).forEach(key => {
        if (contratData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(contratData[key]);
        }
      });
      
      if (fields.length === 0) return false;
      
      values.push(id);
      const sql = `UPDATE contrats SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
      
      const result = await query(sql, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Contrat.update:', error);
      throw error;
    }
  }
}

module.exports = Contrat;