// controllers/projectController.js
const Project = require('../models/Project');
const { query } = require('../config/database');

class ProjectController {
  // Récupérer tous les projets (avec permissions) - MÉTHODE EXISTANTE MISE À JOUR
  static async getAllProjects(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role_nom : req.user.role;
      const { search, status } = req.query;

      console.log(`🔍 Récupération des projets pour utilisateur ${userId} (${userRole})`);

      let projects;
      if (search) {
        projects = await Project.search(search, userId, userRole);
      } else if (status) {
        projects = await Project.getByStatus(status, userId, userRole);
      } else {
        projects = await Project.findAll(userId, userRole);
      }

      // Log pour audit
      console.log(`📋 ${projects.length} projets récupérés par ${req.user.email} (${userRole})`);

      res.json({
        success: true,
        data: projects,
        count: projects.length,
        user_role: userRole,
        message: `${projects.length} projets trouvés`
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des projets:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des projets',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Récupérer un projet par ID - MÉTHODE EXISTANTE MISE À JOUR
  static async getProjectById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role_nom : req.user.role;

      const project = await Project.findById(id, userId, userRole);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé ou accès non autorisé',
          user_role: userRole
        });
      }

      res.json({
        success: true,
        data: project,
        message: 'Projet récupéré avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Créer un nouveau projet - MÉTHODE EXISTANTE AMÉLIORÉE
 static async createProject(req, res) {
    try {
      const { 
        nom, 
        code, 
        description, 
        chef_projet_id, 
        direction_id, 
        statut_id, 
        budget, 
        date_debut, 
        date_fin_prevue, 
        priorite 
      } = req.body;

      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role : req.user.role;

      // Validation des champs obligatoires
      if (!nom || !code || !chef_projet_id || !direction_id || !statut_id) {
        return res.status(400).json({
          success: false,
          message: 'Les champs nom, code, chef de projet, direction et statut sont obligatoires'
        });
      }

      // Préparer les données du projet
      const projectData = {
        nom: nom.trim(),
        code: code.trim(),
        description: description ? description.trim() : null,
        chef_projet_id: parseInt(chef_projet_id),
        direction_id: parseInt(direction_id),
        statut_id: parseInt(statut_id),
        budget: budget ? parseFloat(budget) : null,
        date_debut: date_debut || null,
        date_fin_prevue: date_fin_prevue || null,
        priorite: priorite || 'Normale'
      };

      console.log('🔄 Création de projet avec données:', projectData);

      // Créer le projet
      const projectId = await Project.create(projectData);

      console.log('✅ Projet créé avec ID:', projectId);

      // Récupérer le projet créé pour le retourner complet
      const createdProject = await Project.findById(projectId, userId, userRole);

      // Log pour audit
      console.log(`✅ Nouveau projet créé par ${req.user.email}: "${nom}" (ID: ${projectId})`);

      res.status(201).json({
        success: true,
        message: 'Projet créé avec succès',
        data: createdProject || { id: projectId }
      });

    } catch (error) {
      console.error('❌ Erreur lors de la création du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la création',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Mettre à jour un projet - MÉTHODE EXISTANTE MISE À JOUR
  static async updateProject(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role_nom : req.user.role;
      const updateData = req.body;

      // Vérifier si le projet existe et si l'utilisateur peut le modifier
      const project = await Project.findById(id, userId, userRole);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé ou accès non autorisé'
        });
      }

      // Vérifier les permissions de modification
      if (!Project.canModify(project, userId, userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas les permissions pour modifier ce projet',
          user_role: userRole,
          project_chef: project.chef_projet_nom
        });
      }

      // Mettre à jour
      const updated = await Project.update(id, updateData, userId, userRole);
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'Aucune modification apportée'
        });
      }

      // Log pour audit
      console.log(`✅ Projet "${project.nom}" mis à jour par ${req.user.email}`);

      res.json({
        success: true,
        message: 'Projet mis à jour avec succès',
        data: updated
      });

    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Supprimer un projet - MÉTHODE EXISTANTE MISE À JOUR
  static async deleteProject(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role_nom : req.user.role;

      // Vérifier les permissions de suppression
      if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs et PMO peuvent supprimer des projets',
          user_role: userRole
        });
      }

      // Vérifier si le projet existe
      const project = await Project.findById(id, userId, userRole);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé'
        });
      }

      // Vérifier s'il y a des tâches liées
      const [tasks] = await query('SELECT COUNT(*) as count FROM taches WHERE projet_id = ?', [id]);
      if (tasks[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer un projet qui contient des tâches'
        });
      }

      // Supprimer
      const deleted = await Project.delete(id, userId, userRole);
      if (!deleted) {
        return res.status(400).json({
          success: false,
          message: 'Erreur lors de la suppression'
        });
      }

      // Log pour audit
      console.log(`⚠️ Projet "${project.nom}" supprimé par ${req.user.email}`);

      res.json({
        success: true,
        message: 'Projet supprimé avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Statistiques des projets - MÉTHODE EXISTANTE MISE À JOUR
  static async getProjectStats(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role_nom : req.user.role;

      const stats = await Project.getStats(userId, userRole);

      res.json({
        success: true,
        data: stats,
        user_role: userRole,
        message: 'Statistiques récupérées avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Projets récents - NOUVELLE MÉTHODE
  static async getRecentProjects(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role_nom : req.user.role;
      const limit = parseInt(req.query.limit) || 5;

      const projects = await Project.getRecent(limit, userId, userRole);

      res.json({
        success: true,
        data: projects,
        count: projects.length,
        message: `${projects.length} projets récents récupérés`
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des projets récents:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Tableau de bord des projets pour l'utilisateur connecté - MÉTHODE EXISTANTE MISE À JOUR
  static async getDashboard(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser ? req.user.fullUser.role_nom : req.user.role;

      // Récupérer différentes métriques
      const [stats, recentProjects, myProjects] = await Promise.all([
        Project.getStats(userId, userRole),
        Project.getRecent(5, userId, userRole),
        userRole === 'Chef de Projet' ? Project.findAll(userId, userRole) : []
      ]);

      res.json({
        success: true,
        data: {
          stats,
          recent_projects: recentProjects,
          my_projects: myProjects,
          user_role: userRole
        },
        message: 'Tableau de bord récupéré avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération du dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = ProjectController;