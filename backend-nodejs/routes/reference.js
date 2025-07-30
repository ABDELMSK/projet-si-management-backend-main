// routes/reference.js - CORRIGÉ selon la structure réelle de la BD
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// TEST - Route de vérification
router.get('/test', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 Test des données de référence');
    
    const [directions, statuts, users, roles] = await Promise.all([
      query('SELECT COUNT(*) as count FROM directions'),
      query('SELECT COUNT(*) as count FROM statuts_projet'),
      query('SELECT COUNT(*) as count FROM utilisateurs WHERE statut = "Actif"'),
      query('SELECT COUNT(*) as count FROM roles')
    ]);

    res.json({
      success: true,
      message: 'Test des références réussi',
      data: {
        directions: directions[0].count,
        statuts: statuts[0].count,
        utilisateurs_actifs: users[0].count,
        roles: roles[0].count
      }
    });

  } catch (error) {
    console.error('❌ Erreur test références:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test',
      error: error.message
    });
  }
});

// TOUTES LES DONNÉES EN UNE FOIS - Route principale
router.get('/all', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [/all] Récupération de toutes les données de référence...');

    // Récupérer toutes les données en parallèle avec les colonnes qui existent réellement
    const [directionsResult, statutsResult, utilisateursResult, rolesResult] = await Promise.all([
      // Directions - vérifier si 'description' existe
      query(`
        SELECT id, nom
        ${await checkColumnExists('directions', 'description') ? ', description' : ''}
        FROM directions ORDER BY nom
      `).catch(() => query('SELECT id, nom FROM directions ORDER BY nom')),
      
      // Statuts projet
      query('SELECT id, nom, couleur, ordre FROM statuts_projet ORDER BY ordre'),
      
      // Utilisateurs actifs
      query(`
        SELECT u.id, u.nom, u.email, r.nom as role, r.nom as role_nom, d.nom as direction_nom
        FROM utilisateurs u 
        LEFT JOIN roles r ON u.role_id = r.id 
        LEFT JOIN directions d ON u.direction_id = d.id
        WHERE u.statut = 'Actif' 
        ORDER BY u.nom
      `),
      
      // Rôles - sans 'description' qui cause l'erreur
      query('SELECT id, nom FROM roles ORDER BY nom')
    ]);

    const referenceData = {
      directions: directionsResult,
      statuts: statutsResult,
      utilisateurs: utilisateursResult,
      roles: rolesResult
    };

    console.log('✅ [/all] Données récupérées:', {
      directions: referenceData.directions.length,
      statuts: referenceData.statuts.length,
      utilisateurs: referenceData.utilisateurs.length,
      roles: referenceData.roles.length
    });

    res.json({
      success: true,
      message: 'Données de référence récupérées avec succès',
      data: referenceData
    });

  } catch (error) {
    console.error('❌ [/all] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données de référence',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Fonction helper pour vérifier si une colonne existe
async function checkColumnExists(tableName, columnName) {
  try {
    const [columns] = await query(`SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`);
    return columns.length > 0;
  } catch (error) {
    return false;
  }
}

// DIRECTIONS
router.get('/directions', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [/directions] Récupération des directions...');
    
    // Essayer d'abord avec description, puis sans si elle n'existe pas
    let directions;
    try {
      directions = await query('SELECT id, nom, description FROM directions ORDER BY nom');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('⚠️ Colonne "description" introuvable dans "directions", requête sans description');
        directions = await query('SELECT id, nom FROM directions ORDER BY nom');
      } else {
        throw error;
      }
    }

    console.log(`✅ [/directions] ${directions.length} directions récupérées`);
    res.json({
      success: true,
      message: `${directions.length} direction(s) récupérée(s)`,
      data: directions,
      count: directions.length
    });

  } catch (error) {
    console.error('❌ [/directions] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des directions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// STATUTS
router.get('/statuts', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [/statuts] Récupération des statuts...');
    const statuts = await query('SELECT id, nom, couleur, ordre FROM statuts_projet ORDER BY ordre');

    console.log(`✅ [/statuts] ${statuts.length} statuts récupérés`);
    res.json({
      success: true,
      message: `${statuts.length} statut(s) récupéré(s)`,
      data: statuts,
      count: statuts.length
    });

  } catch (error) {
    console.error('❌ [/statuts] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statuts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// UTILISATEURS
router.get('/utilisateurs', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [/utilisateurs] Récupération des utilisateurs...');
    const utilisateurs = await query(`
      SELECT u.id, u.nom, u.email, r.nom as role, r.nom as role_nom, d.nom as direction_nom
      FROM utilisateurs u 
      LEFT JOIN roles r ON u.role_id = r.id 
      LEFT JOIN directions d ON u.direction_id = d.id
      WHERE u.statut = 'Actif' 
      ORDER BY u.nom
    `);

    console.log(`✅ [/utilisateurs] ${utilisateurs.length} utilisateurs récupérés`);
    res.json({
      success: true,
      message: `${utilisateurs.length} utilisateur(s) récupéré(s)`,
      data: utilisateurs,
      count: utilisateurs.length
    });

  } catch (error) {
    console.error('❌ [/utilisateurs] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// RÔLES - CORRIGÉ SANS DESCRIPTION
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [/roles] Récupération des rôles...');
    
    // Requête corrigée sans la colonne 'description' qui n'existe pas
    const roles = await query('SELECT id, nom FROM roles ORDER BY nom');

    console.log(`✅ [/roles] ${roles.length} rôles récupérés`);
    res.json({
      success: true,
      message: `${roles.length} rôle(s) récupéré(s)`,
      data: roles,
      count: roles.length
    });

  } catch (error) {
    console.error('❌ [/roles] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rôles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PRIORITÉS
router.get('/priorites', authenticateToken, async (req, res) => {
  try {
    const priorites = [
      { id: 'Haute', nom: 'Haute', couleur: '#EF4444' },
      { id: 'Normale', nom: 'Normale', couleur: '#F59E0B' },
      { id: 'Faible', nom: 'Faible', couleur: '#10B981' }
    ];

    res.json({
      success: true,
      message: 'Priorités récupérées avec succès',
      data: priorites,
      count: priorites.length
    });

  } catch (error) {
    console.error('❌ [/priorites] Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des priorités',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;