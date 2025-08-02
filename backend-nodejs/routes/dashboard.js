const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Middleware PMO
const isPMOOrAdmin = (req, res, next) => {
  const user = req.user.fullUser;
  
  if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux PMO et administrateurs'
    });
  }
  
  next();
};

// GET /api/dashboard/advanced - Dashboard avancé PMO
router.get('/advanced', authenticateToken, isPMOOrAdmin, async (req, res) => {
  try {
    console.log('📊 Chargement dashboard avancé PMO...');

    // Indicateurs de performance des projets
    const kpis = await query(`
      SELECT 
        COUNT(*) as total_projets,
        COUNT(CASE WHEN DATEDIFF(date_fin_prevue, CURDATE()) < 0 AND statut_id != (SELECT id FROM statuts_projet WHERE nom = 'Terminé') THEN 1 END) as projets_en_retard,
        COUNT(CASE WHEN pourcentage_avancement >= 90 THEN 1 END) as projets_presque_finis,
        ROUND(AVG(pourcentage_avancement), 1) as avancement_global,
        ROUND(SUM(budget), 2) as budget_total_portefeuille,
        ROUND(SUM(budget_consomme), 2) as budget_consomme_total,
        COUNT(CASE WHEN sante_projet = 'Rouge' THEN 1 END) as projets_risque_eleve
      FROM projets p
      WHERE EXISTS (SELECT 1 FROM statuts_projet s WHERE s.id = p.statut_id AND s.nom != 'Annulé')
    `);

    // Analyse de la charge par chef de projet
    const chargeChefs = await query(`
      SELECT 
        u.nom as chef_projet,
        COUNT(p.id) as nb_projets_actifs,
        ROUND(AVG(p.pourcentage_avancement), 1) as avancement_moyen,
        ROUND(SUM(p.budget), 2) as budget_gere
      FROM utilisateurs u
      INNER JOIN projets p ON u.id = p.chef_projet_id
      INNER JOIN statuts_projet s ON p.statut_id = s.id
      WHERE s.nom IN ('En cours', 'Planification')
      GROUP BY u.id, u.nom
      ORDER BY nb_projets_actifs DESC
    `);

    // Évolution du portefeuille (6 derniers mois)
    const evolutionPortefeuille = await query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as mois,
        COUNT(*) as nouveaux_projets,
        ROUND(SUM(budget), 2) as budget_nouveaux_projets
      FROM projets 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY mois
    `);

    // Analyse des prestataires
    const prestataireStats = await query(`
      SELECT 
        pr.nom as prestataire,
        COUNT(DISTINCT pp.projet_id) as nb_projets,
        COUNT(c.id) as nb_contrats,
        ROUND(SUM(c.montant), 2) as montant_total_contrats
      FROM prestataires pr
      LEFT JOIN projet_prestataires pp ON pr.id = pp.prestataire_id
      LEFT JOIN contrats c ON pr.id = c.prestataire_id
      WHERE pr.statut = 'Actif'
      GROUP BY pr.id, pr.nom
      HAVING nb_projets > 0
      ORDER BY montant_total_contrats DESC
      LIMIT 10
    `);

    // Livrables en retard
    const livrablesEnRetard = await query(`
      SELECT 
        l.nom as livrable,
        p.nom as projet,
        l.date_prevue,
        DATEDIFF(CURDATE(), l.date_prevue) as jours_retard,
        u.nom as responsable
      FROM livrables l
      INNER JOIN projets p ON l.projet_id = p.id
      LEFT JOIN utilisateurs u ON l.responsable_id = u.id
      WHERE l.statut NOT IN ('Livré', 'Validé') 
        AND l.date_prevue < CURDATE()
      ORDER BY jours_retard DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: {
        kpis: kpis[0],
        chargeChefs,
        evolutionPortefeuille,
        prestataireStats,
        livrablesEnRetard,
        derniere_maj: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur dashboard avancé:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement du dashboard'
    });
  }
});

// GET /api/dashboard/alerts - Alertes et notifications
router.get('/alerts', authenticateToken, isPMOOrAdmin, async (req, res) => {
  try {
    // Projets nécessitant une attention
    const alertesProjets = await query(`
      SELECT 
        p.id, p.nom, p.date_fin_prevue, p.pourcentage_avancement, p.sante_projet,
        u.nom as chef_projet_nom, s.nom as statut_nom,
        DATEDIFF(p.date_fin_prevue, CURDATE()) as jours_restants,
        CASE 
          WHEN p.date_fin_prevue < CURDATE() AND s.nom != 'Terminé' THEN 'RETARD'
          WHEN DATEDIFF(p.date_fin_prevue, CURDATE()) <= 15 AND p.pourcentage_avancement < 80 THEN 'RISQUE'
          WHEN p.sante_projet = 'Rouge' THEN 'SANTE_CRITIQUE'
          WHEN p.pourcentage_avancement = 0 AND DATEDIFF(CURDATE(), p.created_at) > 30 THEN 'INACTIF'
          ELSE 'INFO'
        END as type_alerte
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE s.nom NOT IN ('Terminé', 'Annulé')
      HAVING type_alerte != 'INFO'
      ORDER BY 
        CASE type_alerte 
          WHEN 'RETARD' THEN 1 
          WHEN 'SANTE_CRITIQUE' THEN 2 
          WHEN 'RISQUE' THEN 3 
          ELSE 4 
        END,
        jours_restants
    `);

    res.json({
      success: true,
      data: {
        alertes: alertesProjets,
        nb_alertes: alertesProjets.length,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur alertes dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des alertes'
    });
  }
});

module.exports = router;