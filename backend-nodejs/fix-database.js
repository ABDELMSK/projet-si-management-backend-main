// fix-database.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabase() {
  let connection;
  
  try {
    // Connexion à la base de données
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_projets_nodejs',
      port: process.env.DB_PORT || 3306,
    });

    console.log('✅ Connexion à la base de données réussie');

    // 1. Vérifier et corriger les statuts de projet
    console.log('\n🔍 Vérification des statuts de projet...');
    const [statuses] = await connection.execute('SELECT * FROM statuts_projet');
    
    if (statuses.length === 0) {
      console.log('❌ Aucun statut de projet trouvé. Insertion...');
      await connection.execute(`
        INSERT INTO statuts_projet (nom, couleur, ordre) VALUES
        ('Planification', '#FFA500', 1),
        ('En cours', '#0066CC', 2),
        ('En pause', '#FF6B6B', 3),
        ('Terminé', '#4CAF50', 4),
        ('Annulé', '#9E9E9E', 5)
      `);
      console.log('✅ Statuts de projet créés');
    } else {
      console.log(`✅ ${statuses.length} statuts de projet trouvés`);
      statuses.forEach(status => {
        console.log(`   - ${status.nom} (${status.couleur})`);
      });
    }

    // 2. Vérifier les directions
    console.log('\n🔍 Vérification des directions...');
    const [directions] = await connection.execute('SELECT * FROM directions');
    console.log(`✅ ${directions.length} directions trouvées`);
    
    if (directions.length === 0) {
      console.log('❌ Aucune direction trouvée. Insertion...');
      await connection.execute(`
        INSERT INTO directions (nom, description) VALUES
        ('DSI', 'Direction des Systèmes d''Information'),
        ('Marketing', 'Direction Marketing et Communication'),
        ('Finance', 'Direction Financière'),
        ('RH', 'Ressources Humaines'),
        ('Commercial', 'Direction Commerciale'),
        ('Production', 'Direction de la Production')
      `);
      console.log('✅ Directions créées');
    }

    // 3. Vérifier les utilisateurs
    console.log('\n🔍 Vérification des utilisateurs...');
    const [users] = await connection.execute(`
      SELECT u.id, u.nom, u.email, r.nom as role_nom 
      FROM utilisateurs u 
      LEFT JOIN roles r ON u.role_id = r.id
    `);
    console.log(`✅ ${users.length} utilisateurs trouvés`);
    users.forEach(user => {
      console.log(`   - ${user.nom} (${user.email}) - ${user.role_nom}`);
    });

    // 4. Vérifier les projets existants
    console.log('\n🔍 Vérification des projets...');
    const [projects] = await connection.execute(`
      SELECT p.*, u.nom as chef_nom, d.nom as direction_nom, s.nom as statut_nom
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      ORDER BY p.created_at DESC
    `);
    
    console.log(`✅ ${projects.length} projets trouvés`);
    if (projects.length > 0) {
      projects.forEach(project => {
        console.log(`   - "${project.nom}" par ${project.chef_nom} (${project.statut_nom})`);
      });
    } else {
      console.log('💡 Aucun projet trouvé. Création d\'un projet de test...');
      
      // Créer un projet de test
      const adminUser = users.find(u => u.role_nom === 'Administrateur fonctionnel');
      const dsiDirection = await connection.execute('SELECT id FROM directions WHERE nom = "DSI"');
      const enCoursStatus = await connection.execute('SELECT id FROM statuts_projet WHERE nom = "En cours"');
      
      if (adminUser && dsiDirection[0].length > 0 && enCoursStatus[0].length > 0) {
        await connection.execute(`
          INSERT INTO projets (nom, description, chef_projet_id, direction_id, statut_id, pourcentage_avancement, priorite) 
          VALUES (?, ?, ?, ?, ?, 0, 'Normale')
        `, [
          'Projet de Test',
          'Projet créé automatiquement pour tester le système',
          adminUser.id,
          dsiDirection[0][0].id,
          enCoursStatus[0][0].id
        ]);
        console.log('✅ Projet de test créé');
      }
    }

    // 5. Test de création manuelle d'un projet
    console.log('\n🧪 Test de création d\'un projet...');
    try {
      const adminUser = users.find(u => u.role_nom === 'Administrateur fonctionnel');
      const [dirs] = await connection.execute('SELECT * FROM directions LIMIT 1');
      const [stats] = await connection.execute('SELECT * FROM statuts_projet LIMIT 1');
      
      if (adminUser && dirs.length > 0 && stats.length > 0) {
        const [result] = await connection.execute(`
          INSERT INTO projets (nom, description, chef_projet_id, direction_id, statut_id, pourcentage_avancement, priorite, created_at) 
          VALUES (?, ?, ?, ?, ?, 0, 'Normale', NOW())
        `, [
          `Test Manuel ${new Date().getTime()}`,
          'Projet créé par le script de test',
          adminUser.id,
          dirs[0].id,
          stats[0].id
        ]);
        
        console.log(`✅ Projet test créé avec ID: ${result.insertId}`);
        
        // Vérifier immédiatement
        const [verification] = await connection.execute(
          'SELECT * FROM projets WHERE id = ?', 
          [result.insertId]
        );
        console.log('✅ Vérification:', verification[0]);
      } else {
        console.log('❌ Impossible de créer un projet de test - données manquantes');
      }
    } catch (testError) {
      console.error('❌ Erreur lors du test de création:', testError.message);
    }

    console.log('\n🎉 Vérification terminée !');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

// Exécuter le script
fixDatabase();