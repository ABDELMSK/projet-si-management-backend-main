// scripts/check-database-structure.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabaseStructure() {
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

    console.log('✅ Connexion à la base de données réussie\n');

    // Vérifier la structure de la table roles
    console.log('🔍 Structure de la table "roles":');
    const [rolesStructure] = await connection.execute('DESCRIBE roles');
    console.table(rolesStructure);

    // Vérifier le contenu de la table roles
    console.log('\n📋 Contenu de la table "roles":');
    const [rolesData] = await connection.execute('SELECT * FROM roles');
    console.table(rolesData);

    // Vérifier la structure de la table directions
    console.log('\n🔍 Structure de la table "directions":');
    const [directionsStructure] = await connection.execute('DESCRIBE directions');
    console.table(directionsStructure);

    // Vérifier la structure de la table statuts_projet
    console.log('\n🔍 Structure de la table "statuts_projet":');
    const [statusStructure] = await connection.execute('DESCRIBE statuts_projet');
    console.table(statusStructure);

    // Vérifier la structure de la table utilisateurs
    console.log('\n🔍 Structure de la table "utilisateurs":');
    const [usersStructure] = await connection.execute('DESCRIBE utilisateurs');
    console.table(usersStructure);

    // Recommandations de correction
    console.log('\n📝 Recommandations:');
    
    const hasRoleDescription = rolesStructure.some(col => col.Field === 'description');
    if (!hasRoleDescription) {
      console.log('❌ La table "roles" n\'a pas de colonne "description"');
      console.log('💡 Solution: Modifier la requête pour exclure "description" ou ajouter la colonne');
    } else {
      console.log('✅ La table "roles" a une colonne "description"');
    }

    const hasDirectionDescription = directionsStructure.some(col => col.Field === 'description');
    if (!hasDirectionDescription) {
      console.log('❌ La table "directions" n\'a pas de colonne "description"');
    } else {
      console.log('✅ La table "directions" a une colonne "description"');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

// Exécuter le script
if (require.main === module) {
  checkDatabaseStructure();
}

module.exports = { checkDatabaseStructure };