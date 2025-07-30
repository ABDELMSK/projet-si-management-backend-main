// add-code-column.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function addCodeColumn() {
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

    // 1. Vérifier si la colonne 'code' existe déjà
    console.log('\n🔍 Vérification de la colonne "code" dans la table "projets"...');
    
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM projets LIKE 'code'
    `);
    
    if (columns.length > 0) {
      console.log('✅ La colonne "code" existe déjà dans la table "projets"');
      
      // Afficher les colonnes existantes pour debug
      const [allColumns] = await connection.execute('SHOW COLUMNS FROM projets');
      console.log('\n📋 Colonnes existantes dans la table "projets":');
      allColumns.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
      });
      
    } else {
      console.log('❌ La colonne "code" n\'existe pas. Ajout en cours...');
      
      // 2. Ajouter la colonne 'code'
      await connection.execute(`
        ALTER TABLE projets 
        ADD COLUMN code VARCHAR(50) UNIQUE 
        AFTER nom
      `);
      
      console.log('✅ Colonne "code" ajoutée avec succès');
      
      // 3. Vérifier que la colonne a été ajoutée
      const [newColumns] = await connection.execute('SHOW COLUMNS FROM projets');
      console.log('\n📋 Colonnes après modification:');
      newColumns.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
      });
    }

    // 4. Mettre à jour les projets existants sans code
    console.log('\n🔄 Mise à jour des projets existants sans code...');
    
    const [projectsWithoutCode] = await connection.execute(`
      SELECT id, nom FROM projets WHERE code IS NULL OR code = ''
    `);
    
    console.log(`📊 ${projectsWithoutCode.length} projet(s) sans code trouvé(s)`);
    
    if (projectsWithoutCode.length > 0) {
      for (let project of projectsWithoutCode) {
        // Générer un code automatique basé sur le nom et l'ID
        const codeAuto = `PROJ-${project.id.toString().padStart(3, '0')}`;
        
        await connection.execute(`
          UPDATE projets SET code = ? WHERE id = ?
        `, [codeAuto, project.id]);
        
        console.log(`   ✅ Projet "${project.nom}" -> Code: ${codeAuto}`);
      }
    }

    // 5. Test de création d'un projet avec code
    console.log('\n🧪 Test de création d\'un projet avec code...');
    
    try {
      // Récupérer des données de référence pour le test
      const [users] = await connection.execute(`
        SELECT u.id, u.nom, r.nom as role_nom 
        FROM utilisateurs u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE r.nom = 'Administrateur fonctionnel' 
        LIMIT 1
      `);
      
      const [directions] = await connection.execute('SELECT id FROM directions LIMIT 1');
      const [statuses] = await connection.execute('SELECT id FROM statuts_projet LIMIT 1');
      
      if (users.length > 0 && directions.length > 0 && statuses.length > 0) {
        const testCode = `TEST-${Date.now()}`;
        
        const [result] = await connection.execute(`
          INSERT INTO projets (
            nom, code, description, chef_projet_id, direction_id, 
            statut_id, pourcentage_avancement, priorite, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 'Normale', NOW())
        `, [
          'Test Projet avec Code',
          testCode,
          'Projet de test pour vérifier la colonne code',
          users[0].id,
          directions[0].id,
          statuses[0].id
        ]);
        
        console.log(`✅ Projet de test créé avec succès!`);
        console.log(`   - ID: ${result.insertId}`);
        console.log(`   - Code: ${testCode}`);
        
        // Vérification
        const [verification] = await connection.execute(
          'SELECT * FROM projets WHERE id = ?', 
          [result.insertId]
        );
        
        if (verification[0]) {
          console.log(`✅ Vérification: Projet trouvé avec code "${verification[0].code}"`);
        }
        
      } else {
        console.log('⚠️ Impossible de créer un projet de test - données de référence manquantes');
      }
      
    } catch (testError) {
      console.error('❌ Erreur lors du test de création:', testError.message);
      
      // Si l'erreur est liée à une contrainte unique, c'est normal
      if (testError.code === 'ER_DUP_ENTRY') {
        console.log('ℹ️ Erreur de duplication normale lors du test');
      }
    }

    console.log('\n🎉 Migration terminée avec succès !');
    console.log('💡 Vous pouvez maintenant créer des projets avec des codes.');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

// Exécuter le script
console.log('🚀 Démarrage de la migration pour ajouter la colonne "code"...');
addCodeColumn();