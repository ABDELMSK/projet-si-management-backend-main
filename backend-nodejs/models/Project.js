// models/Project.js
const { query } = require('../config/database');

class Project {
  // Créer un nouveau projet
   static async create(projectData) {
  try {
    // Database insertion logic - FIXED: renamed 'query' to 'sql' to avoid conflict
    const sql = `
      INSERT INTO projets (
        nom, code, description, chef_projet_id, direction_id, 
        statut_id, budget, date_debut, date_fin_prevue, priorite, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      projectData.nom,
      projectData.code,
      projectData.description,
      projectData.chef_projet_id,
      projectData.direction_id,
      projectData.statut_id,
      projectData.budget,
      projectData.date_debut,
      projectData.date_fin_prevue,
      projectData.priorite
    ];

    console.log('🔄 Executing SQL:', sql);
    console.log('🔄 With values:', values);

    // FIXED: Use 'query' function instead of 'db.execute'
    const result = await query(sql, values);
    
    console.log('✅ Insert result:', result);
    return result.insertId;
    
  } catch (error) {
    console.error('❌ Error in Project.create:', error);
    throw error;
  }
}
  // Récupérer tous les projets (SIMPLIFIÉ pour debug)
  static async findAll(userId = null, userRole = null) {
  try {
    console.log('🔍 Project.findAll - Début avec:', { userId, userRole });
    
    // FIXED: Added 'code' field to SELECT statement
    let sql = `
      SELECT 
        p.id, p.nom, p.code, p.description, p.chef_projet_id, p.direction_id, p.statut_id,
        p.budget, p.date_debut, p.date_fin_prevue, p.pourcentage_avancement, p.priorite,
        p.created_at, p.updated_at,
        u.nom as chef_projet_nom,
        d.nom as direction_nom,
        s.nom as statut_nom,
        s.couleur as statut_couleur
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
    `;
    
    const params = [];
    
    // Appliquer les filtres selon le rôle
    if (userRole === 'Chef de Projet' && userId) {
      sql += ' WHERE p.chef_projet_id = ?';
      params.push(userId);
      console.log(`🔍 Filtre Chef de Projet: projets du chef ${userId}`);
    } else {
      console.log('🔍 Pas de filtre: tous les projets (Admin/PMO)');
    }
    
    sql += ' ORDER BY p.updated_at DESC';
    
    console.log('🔍 SQL final:', sql);
    console.log('🔍 Paramètres final:', params);
    
    const projects = await query(sql, params);
    
    console.log(`✅ Projets récupérés: ${projects.length}`);
    
    // Ajouter le nombre de tâches (simplifié)
    for (let project of projects) {
      const taches = await query('SELECT COUNT(*) as nb FROM taches WHERE projet_id = ?', [project.id]);
      project.nb_taches = taches[0].nb || 0;
    }
    
    return projects;
    
  } catch (error) {
    console.error('❌ Erreur Project.findAll:', error);
    throw error;
  }
}

  // Trouver un projet par ID
  static async findById(id, userId, userRole) {
  try {
    const sql = `
      SELECT 
        p.*,
        u.nom as chef_projet_nom,
        u.email as chef_projet_email,
        d.nom as direction_nom,
        s.nom as statut_nom,
        s.couleur as statut_couleur
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE p.id = ?
    `;

    // FIXED: Use 'query' function instead of 'db.execute'
    const results = await query(sql, [id]);
    return results[0] || null;
    
  } catch (error) {
    console.error('❌ Error in Project.findById:', error);
    throw error;
  }
}

  // Mettre à jour un projet
  static async update(id, projectData, userId = null, userRole = null) {
    try {
      // Vérifier les permissions avant la mise à jour
      const project = await this.findById(id, userId, userRole);
      if (!project) return false;
      
      // Vérifier les permissions de modification
      if (!this.canModify(project, userId, userRole)) {
        return false;
      }
      
      const fields = [];
      const values = [];
      
      // Construire la requête dynamiquement
      Object.keys(projectData).forEach(key => {
        if (projectData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(projectData[key]);
        }
      });
      
      if (fields.length === 0) return false;
      
      values.push(id);
      const sql = `UPDATE projets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
      
      const result = await query(sql, values);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Project.update:', error);
      throw error;
    }
  }

  // Supprimer un projet
  static async delete(id, userId = null, userRole = null) {
    try {
      // Seuls les admins et PMO peuvent supprimer
      if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(userRole)) {
        return false;
      }
      
      const sql = 'DELETE FROM projets WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ Erreur Project.delete:', error);
      throw error;
    }
  }

  // Vérifier si un utilisateur peut modifier un projet
  static canModify(project, userId, userRole) {
    if (userRole === 'Administrateur fonctionnel') return true;
    if (userRole === 'PMO / Directeur de projets') return true;
    if (userRole === 'Chef de Projet' && project.chef_projet_id === userId) return true;
    return false;
  }

  // Rechercher des projets
  static async search(searchTerm, userId = null, userRole = null) {
    try {
      let sql = `
        SELECT p.*, 
               u.nom as chef_projet_nom,
               d.nom as direction_nom,
               s.nom as statut_nom,
               s.couleur as statut_couleur
        FROM projets p
        LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
        LEFT JOIN directions d ON p.direction_id = d.id
        LEFT JOIN statuts_projet s ON p.statut_id = s.id
        WHERE (p.nom LIKE ? OR p.description LIKE ?)
      `;
      
      const params = [`%${searchTerm}%`, `%${searchTerm}%`];
      
      // Filtrer selon le rôle
      if (userRole === 'Chef de Projet' && userId) {
        sql += ' AND p.chef_projet_id = ?';
        params.push(userId);
      }
      
      sql += ' ORDER BY p.nom ASC';
      
      return await query(sql, params);
    } catch (error) {
      console.error('❌ Erreur Project.search:', error);
      throw error;
    }
  }

  // Statistiques des projets
  static async getStats(userId = null, userRole = null) {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_projets,
          COUNT(CASE WHEN s.nom = 'En cours' THEN 1 END) as projets_en_cours,
          COUNT(CASE WHEN s.nom = 'Terminé' THEN 1 END) as projets_termines,
          COUNT(CASE WHEN s.nom = 'En pause' THEN 1 END) as projets_en_pause,
          COALESCE(AVG(p.pourcentage_avancement), 0) as avancement_moyen,
          COALESCE(SUM(p.budget), 0) as budget_total
        FROM projets p
        LEFT JOIN statuts_projet s ON p.statut_id = s.id
      `;
      
      const params = [];
      
      // Filtrer selon le rôle
      if (userRole === 'Chef de Projet' && userId) {
        sql += ' WHERE p.chef_projet_id = ?';
        params.push(userId);
      }
      
      const results = await query(sql, params);
      return results[0];
    } catch (error) {
      console.error('❌ Erreur Project.getStats:', error);
      throw error;
    }
  }

  // Récupérer les projets récents
  static async getRecent(limit = 5, userId = null, userRole = null) {
    try {
      let sql = `
        SELECT p.id, p.nom, p.pourcentage_avancement, s.nom as statut_nom, s.couleur as statut_couleur,
              u.nom as chef_projet_nom, p.updated_at
        FROM projets p
        LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
        LEFT JOIN statuts_projet s ON p.statut_id = s.id
      `;
      
      const params = [];
      
      // Filtrer selon le rôle
      if (userRole === 'Chef de Projet' && userId) {
        sql += ' WHERE p.chef_projet_id = ?';
        params.push(userId);
      }
      
      sql += ' ORDER BY p.updated_at DESC LIMIT ?';
      params.push(limit);
      
      return await query(sql, params);
    } catch (error) {
      console.error('❌ Erreur Project.getRecent:', error);
      throw error;
    }
  }

  // Récupérer les projets par statut
  static async getByStatus(statusName, userId = null, userRole = null) {
    try {
      let sql = `
        SELECT p.*, u.nom as chef_projet_nom, d.nom as direction_nom, s.nom as statut_nom, s.couleur as statut_couleur
        FROM projets p
        LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
        LEFT JOIN directions d ON p.direction_id = d.id
        LEFT JOIN statuts_projet s ON p.statut_id = s.id
        WHERE s.nom = ?
      `;
      
      const params = [statusName];
      
      // Filtrer selon le rôle
      if (userRole === 'Chef de Projet' && userId) {
        sql += ' AND p.chef_projet_id = ?';
        params.push(userId);
      }
      
      sql += ' ORDER BY p.nom ASC';
      
      return await query(sql, params);
    } catch (error) {
      console.error('❌ Erreur Project.getByStatus:', error);
      throw error;
    }
  }
  
}

module.exports = Project;