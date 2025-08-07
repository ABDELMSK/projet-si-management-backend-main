// 📁 Emplacement: backend-nodejs/models/Phase.js
const { query } = require('../config/database');

class Phase {
  // Créer une nouvelle phase
  static async create(phaseData) {
    try {
      const sql = `
        INSERT INTO phases_projet (
          projet_id, nom, description, date_debut, date_fin_prevue,
          statut, ordre, budget_alloue, budget_consomme, 
          pourcentage_avancement, responsable_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        phaseData.budget_consomme || 0,
        phaseData.pourcentage_avancement || 0,
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
          (SELECT COUNT(*) FROM livrables WHERE phase_id = p.id) as nb_livrables,
          (SELECT COUNT(*) FROM documents_projet WHERE phase_id = p.id) as nb_documents
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

  // Récupérer une phase par ID
  static async findById(id) {
    try {
      const sql = `
        SELECT 
          p.*,
          u.nom as responsable_nom,
          u.email as responsable_email,
          pr.nom as projet_nom,
          pr.code as projet_code,
          (SELECT COUNT(*) FROM livrables WHERE phase_id = p.id) as nb_livrables,
          (SELECT COUNT(*) FROM documents_projet WHERE phase_id = p.id) as nb_documents
        FROM phases_projet p
        LEFT JOIN utilisateurs u ON p.responsable_id = u.id
        LEFT JOIN projets pr ON p.projet_id = pr.id
        WHERE p.id = ?
      `;
      
      const results = await query(sql, [id]);
      return results[0] || null;
    } catch (error) {
      console.error('❌ Erreur Phase.findById:', error);
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
      // Vérifier s'il y a des livrables associés
      const livrables = await query('SELECT COUNT(*) as count FROM livrables WHERE phase_id = ?', [id]);
      if (livrables[0].count > 0) {
        throw new Error(`Impossible de supprimer cette phase : ${livrables[0].count} livrable(s) associé(s)`);
      }

      const sql = 'DELETE FROM phases_projet WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Phase.delete:', error);
      throw error;
    }
  }

  // Récupérer toutes les phases avec filtres
  static async findAll(filters = {}) {
    try {
      let sql = `
        SELECT 
          p.*,
          u.nom as responsable_nom,
          pr.nom as projet_nom,
          pr.code as projet_code,
          (SELECT COUNT(*) FROM livrables WHERE phase_id = p.id) as nb_livrables
        FROM phases_projet p
        LEFT JOIN utilisateurs u ON p.responsable_id = u.id
        LEFT JOIN projets pr ON p.projet_id = pr.id
        WHERE 1=1
      `;
      
      const values = [];
      
      if (filters.statut) {
        sql += ' AND p.statut = ?';
        values.push(filters.statut);
      }
      
      if (filters.responsable_id) {
        sql += ' AND p.responsable_id = ?';
        values.push(filters.responsable_id);
      }
      
      if (filters.projet_id) {
        sql += ' AND p.projet_id = ?';
        values.push(filters.projet_id);
      }
      
      if (filters.date_debut) {
        sql += ' AND p.date_debut >= ?';
        values.push(filters.date_debut);
      }
      
      if (filters.date_fin) {
        sql += ' AND p.date_fin_prevue <= ?';
        values.push(filters.date_fin);
      }
      
      sql += ' ORDER BY pr.nom, p.ordre ASC';
      
      return await query(sql, values);
    } catch (error) {
      console.error('❌ Erreur Phase.findAll:', error);
      throw error;
    }
  }

  // Statistiques d'une phase
  static async getStatistics(phaseId) {
    try {
      const sql = `
        SELECT 
          p.*,
          (SELECT COUNT(*) FROM livrables WHERE phase_id = p.id) as nb_livrables,
          (SELECT COUNT(*) FROM livrables WHERE phase_id = p.id AND statut = 'Validé') as nb_livrables_valides,
          (SELECT COUNT(*) FROM documents_projet WHERE phase_id = p.id) as nb_documents,
          (SELECT COALESCE(SUM(montant_prevu), 0) FROM budget_details WHERE phase_id = p.id) as budget_prevu,
          (SELECT COALESCE(SUM(montant_reel), 0) FROM budget_details WHERE phase_id = p.id) as budget_reel
        FROM phases_projet p
        WHERE p.id = ?
      `;
      
      const results = await query(sql, [phaseId]);
      const stats = results[0];
      
      if (stats) {
        // Calculs supplémentaires
        stats.taux_livrables_valides = stats.nb_livrables > 0 
          ? Math.round((stats.nb_livrables_valides / stats.nb_livrables) * 100)
          : 0;
        stats.ecart_budget = stats.budget_reel - stats.budget_prevu;
        stats.taux_consommation_budget = stats.budget_prevu > 0 
          ? Math.round((stats.budget_reel / stats.budget_prevu) * 100)
          : 0;
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Erreur Phase.getStatistics:', error);
      throw error;
    }
  }

  // Phases en retard
  static async findOverdue() {
    try {
      const sql = `
        SELECT 
          p.*,
          pr.nom as projet_nom,
          pr.code as projet_code,
          u.nom as responsable_nom,
          DATEDIFF(CURDATE(), p.date_fin_prevue) as jours_retard
        FROM phases_projet p
        LEFT JOIN projets pr ON p.projet_id = pr.id
        LEFT JOIN utilisateurs u ON p.responsable_id = u.id
        WHERE p.statut IN ('Planifiée', 'En cours')
          AND p.date_fin_prevue < CURDATE()
        ORDER BY p.date_fin_prevue ASC
      `;
      
      return await query(sql);
    } catch (error) {
      console.error('❌ Erreur Phase.findOverdue:', error);
      throw error;
    }
  }

  // Phases à venir dans les X jours
  static async findUpcoming(days = 7) {
    try {
      const sql = `
        SELECT 
          p.*,
          pr.nom as projet_nom,
          pr.code as projet_code,
          u.nom as responsable_nom,
          DATEDIFF(p.date_debut, CURDATE()) as jours_avant_debut
        FROM phases_projet p
        LEFT JOIN projets pr ON p.projet_id = pr.id
        LEFT JOIN utilisateurs u ON p.responsable_id = u.id
        WHERE p.statut = 'Planifiée'
          AND p.date_debut BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ORDER BY p.date_debut ASC
      `;
      
      return await query(sql, [days]);
    } catch (error) {
      console.error('❌ Erreur Phase.findUpcoming:', error);
      throw error;
    }
  }

  // Mettre à jour l'avancement d'une phase en fonction des livrables
  static async updateProgressFromLivrables(phaseId) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_livrables,
          COUNT(CASE WHEN statut = 'Validé' THEN 1 END) as livrables_valides,
          COALESCE(SUM(poids_projet), 0) as poids_total,
          COALESCE(SUM(CASE WHEN statut = 'Validé' THEN poids_projet ELSE 0 END), 0) as poids_valides
        FROM livrables
        WHERE phase_id = ?
      `;
      
      const results = await query(sql, [phaseId]);
      const stats = results[0];
      
      let nouvelAvancement = 0;
      
      if (stats.poids_total > 0) {
        // Calcul basé sur les poids des livrables
        nouvelAvancement = Math.round((stats.poids_valides / stats.poids_total) * 100);
      } else if (stats.total_livrables > 0) {
        // Calcul basé sur le nombre de livrables
        nouvelAvancement = Math.round((stats.livrables_valides / stats.total_livrables) * 100);
      }
      
      // Limiter à 100%
      nouvelAvancement = Math.min(nouvelAvancement, 100);
      
      // Mettre à jour la phase
      await this.update(phaseId, { pourcentage_avancement: nouvelAvancement });
      
      return nouvelAvancement;
    } catch (error) {
      console.error('❌ Erreur Phase.updateProgressFromLivrables:', error);
      throw error;
    }
  }

  // Dupliquer une phase (pour un autre projet)
  static async duplicate(phaseId, newProjectId) {
    try {
      const originalPhase = await this.findById(phaseId);
      if (!originalPhase) {
        throw new Error('Phase originale non trouvée');
      }

      const newPhaseData = {
        projet_id: newProjectId,
        nom: originalPhase.nom,
        description: originalPhase.description,
        statut: 'Planifiée',
        ordre: originalPhase.ordre,
        budget_alloue: originalPhase.budget_alloue,
        budget_consomme: 0,
        pourcentage_avancement: 0
        // Les dates et responsable ne sont pas copiés
      };

      const newPhaseId = await this.create(newPhaseData);
      return newPhaseId;
    } catch (error) {
      console.error('❌ Erreur Phase.duplicate:', error);
      throw error;
    }
  }

  // Réorganiser l'ordre des phases d'un projet
  static async reorder(projectId, phaseOrders) {
    try {
      // phaseOrders est un array d'objets { id, ordre }
      const promises = phaseOrders.map(({ id, ordre }) => 
        this.update(id, { ordre })
      );
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('❌ Erreur Phase.reorder:', error);
      throw error;
    }
  }

  // Statistiques globales des phases
  static async getGlobalStatistics() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_phases,
          COUNT(CASE WHEN statut = 'Planifiée' THEN 1 END) as planifiees,
          COUNT(CASE WHEN statut = 'En cours' THEN 1 END) as en_cours,
          COUNT(CASE WHEN statut = 'Terminée' THEN 1 END) as terminees,
          COUNT(CASE WHEN statut = 'En pause' THEN 1 END) as en_pause,
          COUNT(CASE WHEN statut = 'Annulée' THEN 1 END) as annulees,
          COALESCE(AVG(pourcentage_avancement), 0) as avancement_moyen,
          COALESCE(SUM(budget_alloue), 0) as budget_total_alloue,
          COALESCE(SUM(budget_consomme), 0) as budget_total_consomme
        FROM phases_projet
      `;
      
      const results = await query(sql);
      return results[0];
    } catch (error) {
      console.error('❌ Erreur Phase.getGlobalStatistics:', error);
      throw error;
    }
  }
}

module.exports = Phase;