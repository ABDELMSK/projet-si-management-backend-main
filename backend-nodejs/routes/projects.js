// routes/projects.js
const express = require('express');
const router = express.Router();
const ProjectController = require('../controllers/projectController');
const { authenticateToken, canCreateProject } = require('../middleware/auth');

// Route de test pour vérifier le fonctionnement de l'API
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../config/database');
    
    console.log('🧪 Test de l\'API projets');
    console.log('User info:', req.user);
    
    // Test de comptage simple
    const [projectCount] = await query('SELECT COUNT(*) as count FROM projets');
    const [userCount] = await query('SELECT COUNT(*) as count FROM utilisateurs WHERE statut = "Actif"');
    const [directionCount] = await query('SELECT COUNT(*) as count FROM directions');
    const [statusCount] = await query('SELECT COUNT(*) as count FROM statuts_projet');
    
    res.json({
      success: true,
      message: 'Test de l\'API projets réussi',
      data: {
        projets: projectCount.count,
        utilisateurs: userCount.count,
        directions: directionCount.count,
        statuts: statusCount.count,
        user_role: req.user.fullUser ? req.user.fullUser.role_nom : req.user.role,
        user_id: req.user.userId
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur test API:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test',
      error: error.message
    });
  }
});

// Route de debug pour la création (temporaire)
router.post('/debug-create', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../config/database');
    
    console.log('🐛 DEBUG - Body reçu:', req.body);
    console.log('🐛 DEBUG - User info:', req.user);
    
    // Test des tables de référence
    const statuses = await query('SELECT * FROM statuts_projet');
    const directions = await query('SELECT * FROM directions');
    const users = await query('SELECT id, nom FROM utilisateurs WHERE statut = "Actif"');
    
    console.log('🐛 DEBUG - Statuts trouvés:', statuses.length);
    console.log('🐛 DEBUG - Directions trouvées:', directions.length);
    console.log('🐛 DEBUG - Utilisateurs trouvés:', users.length);
    
    // Création d'un projet de test
    const testProject = {
      nom: `Test Debug ${new Date().getTime()}`,
      description: 'Projet de test pour debug',
      chef_projet_id: req.user.userId,
      direction_id: directions[0]?.id || 1,
      statut_id: statuses[0]?.id || 1,
      pourcentage_avancement: 0,
      priorite: 'Normale'
    };
    
    console.log('🐛 DEBUG - Tentative de création avec:', testProject);
    
    const result = await query(`
      INSERT INTO projets (nom, description, chef_projet_id, direction_id, statut_id, pourcentage_avancement, priorite, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      testProject.nom,
      testProject.description,
      testProject.chef_projet_id,
      testProject.direction_id,
      testProject.statut_id,
      testProject.pourcentage_avancement,
      testProject.priorite
    ]);
    
    console.log('🐛 DEBUG - Résultat insertion:', result);
    
    // Vérification
    const verification = await query('SELECT * FROM projets WHERE id = ?', [result.insertId]);
    
    res.json({
      success: true,
      message: 'Debug création réussi',
      data: {
        insertId: result.insertId,
        verification: verification[0],
        references: {
          statuses: statuses.length,
          directions: directions.length,
          users: users.length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur debug création:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du debug',
      error: error.message
    });
  }
});

// Routes principales CRUD

// GET /api/projects - Récupérer tous les projets
router.get('/', authenticateToken, ProjectController.getAllProjects);

// GET /api/projects/stats - Statistiques des projets
router.get('/stats', authenticateToken, ProjectController.getProjectStats);

// GET /api/projects/recent - Projets récents
router.get('/recent', authenticateToken, ProjectController.getRecentProjects);

// GET /api/projects/dashboard - Tableau de bord des projets
router.get('/dashboard', authenticateToken, ProjectController.getDashboard);

// GET /api/projects/:id - Récupérer un projet par ID
router.get('/:id', authenticateToken, ProjectController.getProjectById);

// POST /api/projects - Créer un nouveau projet
router.post('/', authenticateToken, ProjectController.createProject);

// PUT /api/projects/:id - Mettre à jour un projet
router.put('/:id', authenticateToken, ProjectController.updateProject);

// DELETE /api/projects/:id - Supprimer un projet
router.delete('/:id', authenticateToken, ProjectController.deleteProject);

module.exports = router;