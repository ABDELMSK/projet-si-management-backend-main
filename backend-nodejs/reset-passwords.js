// reset-passwords.js
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetPasswords() {
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

    // Générer le hash pour "admin123"
    const password = 'admin123';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    console.log('🔐 Hash généré pour "admin123":', hashedPassword);

    // Lister tous les utilisateurs
    const [users] = await connection.execute('SELECT id, nom, email FROM utilisateurs');
    console.log('\n👥 Utilisateurs trouvés:');
    users.forEach(user => {
      console.log(`- ${user.nom} (${user.email})`);
    });

    // Mettre à jour tous les mots de passe
    const [result] = await connection.execute(
      'UPDATE utilisateurs SET password_hash = ?',
      [hashedPassword]
    );

    console.log(`\n✅ ${result.affectedRows} mots de passe mis à jour avec succès!`);
    console.log('\n🎯 Vous pouvez maintenant vous connecter avec:');
    console.log('   Mot de passe: admin123');
    console.log('\n📧 Comptes disponibles:');
    users.forEach(user => {
      console.log(`   ${user.email} / admin123`);
    });

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
resetPasswords();