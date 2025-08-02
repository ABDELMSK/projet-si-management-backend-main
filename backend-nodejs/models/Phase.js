// backend-nodejs/models/Phase.js
const { query } = require('../config/database');

class Phase {
  // Créer une nouvelle phase
  static async create(phaseData) {
    try {
      const sql = `
        INSERT INTO phases_projet (
          projet_id, nom, description, date_debut, date_fin_prevue, 
          statut, ordre, budget_alloue, responsable_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        phaseData.projet_id,
        phaseData.nom,
        phaseData.description,
        phaseData.date_debut,
        phaseData.date_fin_prevue,
        phaseData.statut || 'Planifiée',
        phaseData.ordre || 0,
        phaseData.budget_alloue || 0,
        phaseData.responsable_id
      ];

      const result = await query(sql, values);
      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur Phase.create:', error);
      throw error;
    }
  }

  // Récupérer les phases d'un projet
  static async findByProject(projectId) {
    try {
      const sql = `
        SELECT 
          p.*,
          u.nom as responsable_nom,
          u.email as responsable_email,
          (SELECT COUNT(*) FROM livrables WHERE phase_id = p.id) as nb_livrables
        FROM phases_projet p
        LEFT JOIN utilisateurs u ON p.responsable_id = u.id
        WHERE p.projet_id = ?
        ORDER BY p.ordre ASC, p.created_at ASC
      `;
      
      return await query(sql, [projectId]);
    } catch (error) {
      console.error('❌ Erreur Phase.findByProject:', error);
      throw error;
    }
  }

  // Mettre à jour une phase
  static async update(id, phaseData) {
    try {
      const fields = [];
      const values = [];
      
      Object.keys(phaseData).forEach(key => {
        if (phaseData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(phaseData[key]);
        }
      });
      
      if (fields.length === 0) return false;
      
      values.push(id);
      const sql = `UPDATE phases_projet SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
      
      const result = await query(sql, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Phase.update:', error);
      throw error;
    }
  }

  // Supprimer une phase
  static async delete(id) {
    try {
      const sql = 'DELETE FROM phases_projet WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Phase.delete:', error);
      throw error;
    }
  }
}

module.exports = Phase;





