const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const ExcelJS = require('exceljs'); // npm install exceljs
const PDFDocument = require('pdfkit'); // npm install pdfkit

// Middleware pour vérifier les permissions PMO/Admin
const canAccessReports = (req, res, next) => {
  const user = req.user.fullUser;
  
  if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
    return res.status(403).json({
      success: false,
      message: 'Seuls les administrateurs et PMO peuvent accéder aux rapports',
      user_role: user.role_nom
    });
  }
  
  next();
};

// GET /api/reports/projects/excel - Export Excel des projets
router.get('/projects/excel', authenticateToken, canAccessReports, async (req, res) => {
  try {
    console.log('📊 Génération du rapport Excel des projets...');
    
    // Récupérer les données des projets avec détails
    const projects = await query(`
      SELECT 
        p.id, p.nom, p.code, p.description, p.budget, p.budget_consomme,
        p.date_debut, p.date_fin_prevue, p.pourcentage_avancement, p.priorite,
        u.nom as chef_projet_nom, u.email as chef_projet_email,
        d.nom as direction_nom, s.nom as statut_nom, s.couleur as statut_couleur,
        (SELECT COUNT(*) FROM phases_projet WHERE projet_id = p.id) as nb_phases,
        (SELECT COUNT(*) FROM livrables WHERE projet_id = p.id) as nb_livrables,
        (SELECT COUNT(*) FROM contrats WHERE projet_id = p.id) as nb_contrats,
        (SELECT COUNT(*) FROM documents_projet WHERE projet_id = p.id) as nb_documents
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id  
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      ORDER BY p.created_at DESC
    `);

    // Créer le workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Projets');

    // Headers
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Nom du projet', key: 'nom', width: 30 },
      { header: 'Chef de projet', key: 'chef_projet_nom', width: 20 },
      { header: 'Direction', key: 'direction_nom', width: 15 },
      { header: 'Statut', key: 'statut_nom', width: 15 },
      { header: 'Budget (€)', key: 'budget', width: 15 },
      { header: 'Consommé (€)', key: 'budget_consomme', width: 15 },
      { header: 'Avancement (%)', key: 'pourcentage_avancement', width: 15 },
      { header: 'Priorité', key: 'priorite', width: 12 },
      { header: 'Date début', key: 'date_debut', width: 12 },
      { header: 'Date fin prévue', key: 'date_fin_prevue', width: 15 },
      { header: 'Nb Phases', key: 'nb_phases', width: 10 },
      { header: 'Nb Livrables', key: 'nb_livrables', width: 12 },
      { header: 'Nb Contrats', key: 'nb_contrats', width: 12 },
      { header: 'Nb Documents', key: 'nb_documents', width: 12 }
    ];

    // Style des headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };

    // Ajouter les données
    projects.forEach(project => {
      worksheet.addRow({
        ...project,
        date_debut: project.date_debut ? new Date(project.date_debut) : null,
        date_fin_prevue: project.date_fin_prevue ? new Date(project.date_fin_prevue) : null
      });
    });

    // Autofit des colonnes
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width, 10);
    });

    // Envoyer le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=projets_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

    console.log('✅ Rapport Excel généré avec succès');
    
  } catch (error) {
    console.error('❌ Erreur génération rapport Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport Excel'
    });
  }
});

// GET /api/reports/dashboard/data - Données pour dashboard PMO
router.get('/dashboard/data', authenticateToken, canAccessReports, async (req, res) => {
  try {
    console.log('📊 Récupération des données dashboard PMO...');

    // Statistiques générales
    const [stats] = await query(`
      SELECT 
        COUNT(*) as total_projets,
        COUNT(CASE WHEN s.nom = 'En cours' THEN 1 END) as projets_en_cours,
        COUNT(CASE WHEN s.nom = 'Terminé' THEN 1 END) as projets_termines,
        COUNT(CASE WHEN s.nom = 'En pause' THEN 1 END) as projets_en_pause,
        COALESCE(SUM(p.budget), 0) as budget_total,
        COALESCE(SUM(p.budget_consomme), 0) as budget_consomme,
        COALESCE(AVG(p.pourcentage_avancement), 0) as avancement_moyen
      FROM projets p
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
    `);

    // Projets par direction
    const projetsParDirection = await query(`
      SELECT 
        d.nom as direction,
        COUNT(p.id) as nb_projets,
        COALESCE(SUM(p.budget), 0) as budget_total,
        COALESCE(AVG(p.pourcentage_avancement), 0) as avancement_moyen
      FROM directions d
      LEFT JOIN projets p ON d.id = p.direction_id
      GROUP BY d.id, d.nom
      ORDER BY nb_projets DESC
    `);

    // Projets par statut
    const projetsParStatut = await query(`
      SELECT 
        s.nom as statut,
        s.couleur,
        COUNT(p.id) as nb_projets
      FROM statuts_projet s
      LEFT JOIN projets p ON s.id = p.statut_id
      GROUP BY s.id, s.nom, s.couleur
      ORDER BY s.ordre
    `);

    // Évolution mensuelle des projets
    const evolutionMensuelle = await query(`
      SELECT 
        DATE_FORMAT(p.created_at, '%Y-%m') as mois,
        COUNT(*) as nouveaux_projets,
        COUNT(CASE WHEN s.nom = 'Terminé' THEN 1 END) as projets_termines
      FROM projets p
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(p.created_at, '%Y-%m')
      ORDER BY mois
    `);

    // Top 5 des projets les plus avancés
    const topProjets = await query(`
      SELECT 
        p.nom, p.pourcentage_avancement, u.nom as chef_projet_nom, s.nom as statut_nom
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE s.nom != 'Terminé'
      ORDER BY p.pourcentage_avancement DESC
      LIMIT 5
    `);

    // Alertes et points d'attention
    const alertes = await query(`
      SELECT 
        p.nom, p.date_fin_prevue, p.pourcentage_avancement, u.nom as chef_projet_nom
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE s.nom = 'En cours' 
        AND (p.date_fin_prevue < CURDATE() OR 
             (p.date_fin_prevue <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND p.pourcentage_avancement < 80))
      ORDER BY p.date_fin_prevue
    `);

    res.json({
      success: true,
      data: {
        stats: stats,
        projetsParDirection,
        projetsParStatut,
        evolutionMensuelle,
        topProjets,
        alertes,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération données dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données dashboard'
    });
  }
});

// GET /api/reports/project/:id/detail - Rapport détaillé d'un projet
router.get('/project/:id/detail', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Informations générales du projet
    const [projectInfo] = await query(`
      SELECT 
        p.*, u.nom as chef_projet_nom, u.email as chef_projet_email,
        d.nom as direction_nom, s.nom as statut_nom, s.couleur as statut_couleur
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE p.id = ?
    `, [id]);

    if (!projectInfo) {
      return res.status(404).json({
        success: false,
        message: 'Projet non trouvé'
      });
    }

    // Phases du projet
    const phases = await query(`
      SELECT 
        ph.*, u.nom as responsable_nom,
        COUNT(l.id) as nb_livrables
      FROM phases_projet ph
      LEFT JOIN utilisateurs u ON ph.responsable_id = u.id
      LEFT JOIN livrables l ON ph.id = l.phase_id
      WHERE ph.projet_id = ?
      GROUP BY ph.id
      ORDER BY ph.ordre
    `, [id]);

    // Livrables
    const livrables = await query(`
      SELECT 
        l.*, ph.nom as phase_nom, u1.nom as responsable_nom, u2.nom as validateur_nom
      FROM livrables l
      LEFT JOIN phases_projet ph ON l.phase_id = ph.id
      LEFT JOIN utilisateurs u1 ON l.responsable_id = u1.id
      LEFT JOIN utilisateurs u2 ON l.validateur_id = u2.id
      WHERE l.projet_id = ?
      ORDER BY l.date_prevue
    `, [id]);

    // Contrats
    const contrats = await query(`
      SELECT 
        c.*, pr.nom as prestataire_nom, u.nom as created_by_nom
      FROM contrats c
      LEFT JOIN prestataires pr ON c.prestataire_id = pr.id
      LEFT JOIN utilisateurs u ON c.created_by = u.id
      WHERE c.projet_id = ?
      ORDER BY c.created_at
    `, [id]);

    // Documents
    const documents = await query(`
      SELECT 
        d.*, ph.nom as phase_nom, l.nom as livrable_nom, u.nom as uploaded_by_nom
      FROM documents_projet d
      LEFT JOIN phases_projet ph ON d.phase_id = ph.id
      LEFT JOIN livrables l ON d.livrable_id = l.id
      LEFT JOIN utilisateurs u ON d.uploaded_by = u.id
      WHERE d.projet_id = ?
      ORDER BY d.uploaded_at DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        projet: projectInfo,
        phases,
        livrables,
        contrats,
        documents,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur rapport détaillé projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport détaillé'
    });
  }
});

module.exports = router;