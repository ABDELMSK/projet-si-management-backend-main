// backend-nodejs/models/Prestataire.js
const { query } = require('../config/database');

class Prestataire {
  // Créer un nouveau prestataire
  static async create(prestataireData) {
    try {
      const sql = `
        INSERT INTO prestataires (
          nom, siret, adresse, contact_nom, contact_email, 
          contact_telephone, domaine_expertise, statut
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        prestataireData.nom,
        prestataireData.siret,
        prestataireData.adresse,
        prestataireData.contact_nom,
        prestataireData.contact_email,
        prestataireData.contact_telephone,
        prestataireData.domaine_expertise,
        prestataireData.statut || 'Actif'
      ];

      const result = await query(sql, values);
      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur Prestataire.create:', error);
      throw error;
    }
  }

  // Récupérer tous les prestataires actifs
  static async findAll() {
    try {
      const sql = `
        SELECT 
          p.*,
          COUNT(pp.id) as nb_projets_actifs
        FROM prestataires p
        LEFT JOIN projet_prestataires pp ON p.id = pp.prestataire_id AND pp.statut = 'Actif'
        WHERE p.statut = 'Actif'
        GROUP BY p.id
        ORDER BY p.nom ASC
      `;
      
      return await query(sql);
    } catch (error) {
      console.error('❌ Erreur Prestataire.findAll:', error);
      throw error;
    }
  }

  // Associer un prestataire à un projet
  static async associateToProject(projectId, prestataireId, role, dateDebut = null) {
    try {
      const sql = `
        INSERT INTO projet_prestataires (projet_id, prestataire_id, role_prestataire, date_debut)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        role_prestataire = VALUES(role_prestataire),
        date_debut = VALUES(date_debut),
        statut = 'Actif'
      `;

      const result = await query(sql, [projectId, prestataireId, role, dateDebut]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Prestataire.associateToProject:', error);
      throw error;
    }
  }

  // Récupérer les prestataires d'un projet
  static async findByProject(projectId) {
    try {
      const sql = `
        SELECT 
          p.*,
          pp.role_prestataire,
          pp.date_debut,
          pp.date_fin,
          pp.statut as statut_association
        FROM prestataires p
        INNER JOIN projet_prestataires pp ON p.id = pp.prestataire_id
        WHERE pp.projet_id = ? AND pp.statut = 'Actif'
        ORDER BY p.nom ASC
      `;
      
      return await query(sql, [projectId]);
    } catch (error) {
      console.error('❌ Erreur Prestataire.findByProject:', error);
      throw error;
    }
  }
}

module.exports = Prestataire;
