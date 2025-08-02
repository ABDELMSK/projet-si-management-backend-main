// backend-nodejs/scripts/install-new-features.js
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class FeatureInstaller {
  constructor() {
    this.connection = null;
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gestion_projets_nodejs',
        port: process.env.DB_PORT || 3306,
      });
      
      console.log('✅ Connexion à la base de données réussie');
      return true;
    } catch (error) {
      console.error('❌ Erreur de connexion à la base de données:', error.message);
      this.errors.push('Connexion base de données échouée');
      return false;
    }
  }

  async checkPrerequisites() {
    console.log('\n🔍 Vérification des prérequis...');
    
    try {
      // Vérifier que les tables de base existent
      const requiredTables = ['projets', 'utilisateurs', 'roles', 'directions', 'statuts_projet'];
      
      for (const table of requiredTables) {
        const [rows] = await this.connection.execute(`SHOW TABLES LIKE '${table}'`);
        if (rows.length === 0) {
          this.errors.push(`Table manquante: ${table}`);
        } else {
          this.success.push(`Table ${table} trouvée`);
        }
      }

      // Vérifier que les colonnes critiques existent
      const [projectColumns] = await this.connection.execute('DESCRIBE projets');
      const hasCodeColumn = projectColumns.some(col => col.Field === 'code');
      
      if (!hasCodeColumn) {
        this.warnings.push('Colonne "code" manquante dans la table projets - sera ajoutée');
      }

      // Vérifier les dépendances npm
      const packageJsonPath = path.join(__dirname, '../package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const requiredDeps = ['exceljs', 'pdfkit', 'multer'];
        
        for (const dep of requiredDeps) {
          if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
            this.warnings.push(`Dépendance manquante: ${dep} - sera installée`);
          }
        }
      }

      console.log(`✅ ${this.success.length} vérifications réussies`);
      if (this.warnings.length > 0) {
        console.log(`⚠️ ${this.warnings.length} avertissements`);
      }
      if (this.errors.length > 0) {
        console.log(`❌ ${this.errors.length} erreurs critiques`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des prérequis:', error.message);
      return false;
    }
  }

  async installDependencies() {
    console.log('\n📦 Installation des dépendances npm...');
    
    const { spawn } = require('child_process');
    const requiredDeps = ['exceljs', 'pdfkit', 'multer'];
    
    return new Promise((resolve) => {
      const npm = spawn('npm', ['install', ...requiredDeps], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });

      npm.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Dépendances installées avec succès');
          resolve(true);
        } else {
          console.log('⚠️ Erreur lors de l\'installation des dépendances');
          resolve(false);
        }
      });
    });
  }

  async createTables() {
    console.log('\n🗄️ Création des nouvelles tables...');

    const tables = [
      {
        name: 'prestataires',
        sql: `
          CREATE TABLE IF NOT EXISTS prestataires (
            id INT PRIMARY KEY AUTO_INCREMENT,
            nom VARCHAR(255) NOT NULL,
            siret VARCHAR(14) UNIQUE,
            adresse TEXT,
            contact_nom VARCHAR(255),
            contact_email VARCHAR(255),
            contact_telephone VARCHAR(20),
            domaine_expertise TEXT,
            statut ENUM('Actif', 'Inactif', 'Suspendu') DEFAULT 'Actif',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_statut (statut),
            INDEX idx_nom (nom)
          )
        `
      },
      {
        name: 'phases_projet',
        sql: `
          CREATE TABLE IF NOT EXISTS phases_projet (
            id INT PRIMARY KEY AUTO_INCREMENT,
            projet_id INT NOT NULL,
            nom VARCHAR(255) NOT NULL,
            description TEXT,
            date_debut DATE,
            date_fin_prevue DATE,
            date_fin_reelle DATE,
            statut ENUM('Planifiée', 'En cours', 'Terminée', 'En pause', 'Annulée') DEFAULT 'Planifiée',
            ordre INT DEFAULT 0,
            budget_alloue DECIMAL(15,2) DEFAULT 0,
            budget_consomme DECIMAL(15,2) DEFAULT 0,
            pourcentage_avancement INT DEFAULT 0,
            responsable_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
            FOREIGN KEY (responsable_id) REFERENCES utilisateurs(id) ON DELETE SET NULL,
            INDEX idx_projet_id (projet_id),
            INDEX idx_statut (statut),
            INDEX idx_ordre (ordre)
          )
        `
      },
      {
        name: 'contrats',
        sql: `
          CREATE TABLE IF NOT EXISTS contrats (
            id INT PRIMARY KEY AUTO_INCREMENT,
            projet_id INT NOT NULL,
            numero_contrat VARCHAR(100) UNIQUE NOT NULL,
            intitule VARCHAR(255) NOT NULL,
            prestataire_id INT,
            montant DECIMAL(15,2),
            date_signature DATE,
            date_debut DATE,
            date_fin DATE,
            statut ENUM('En négociation', 'Signé', 'En cours', 'Terminé', 'Résilié') DEFAULT 'En négociation',
            fichier_contrat VARCHAR(500),
            conditions_particulieres TEXT,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
            FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES utilisateurs(id),
            INDEX idx_projet_id (projet_id),
            INDEX idx_statut (statut),
            INDEX idx_numero (numero_contrat)
          )
        `
      },
      {
        name: 'livrables',
        sql: `
          CREATE TABLE IF NOT EXISTS livrables (
            id INT PRIMARY KEY AUTO_INCREMENT,
            projet_id INT NOT NULL,
            phase_id INT,
            contrat_id INT,
            nom VARCHAR(255) NOT NULL,
            description TEXT,
            type_livrable ENUM('Document', 'Code', 'Formation', 'Matériel', 'Service') DEFAULT 'Document',
            date_prevue DATE,
            date_reelle DATE,
            statut ENUM('Planifié', 'En cours', 'Livré', 'Validé', 'Refusé') DEFAULT 'Planifié',
            responsable_id INT,
            validateur_id INT,
            fichier_path VARCHAR(500),
            commentaires TEXT,
            poids_projet DECIMAL(5,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
            FOREIGN KEY (phase_id) REFERENCES phases_projet(id) ON DELETE SET NULL,
            FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE SET NULL,
            FOREIGN KEY (responsable_id) REFERENCES utilisateurs(id) ON DELETE SET NULL,
            FOREIGN KEY (validateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL,
            INDEX idx_projet_id (projet_id),
            INDEX idx_phase_id (phase_id),
            INDEX idx_statut (statut)
          )
        `
      },
      {
        name: 'documents_projet',
        sql: `
          CREATE TABLE IF NOT EXISTS documents_projet (
            id INT PRIMARY KEY AUTO_INCREMENT,
            projet_id INT NOT NULL,
            phase_id INT,
            livrable_id INT,
            contrat_id INT,
            nom_fichier VARCHAR(255) NOT NULL,
            nom_original VARCHAR(255) NOT NULL,
            chemin_fichier VARCHAR(500) NOT NULL,
            taille_fichier INT,
            type_mime VARCHAR(100),
            categorie ENUM('Cahier des charges', 'Contrat', 'Livrable', 'PV', 'Planning', 'Budget', 'Autre') DEFAULT 'Autre',
            description TEXT,
            version VARCHAR(10) DEFAULT '1.0',
            uploaded_by INT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
            FOREIGN KEY (phase_id) REFERENCES phases_projet(id) ON DELETE SET NULL,
            FOREIGN KEY (livrable_id) REFERENCES livrables(id) ON DELETE SET NULL,
            FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE SET NULL,
            FOREIGN KEY (uploaded_by) REFERENCES utilisateurs(id),
            INDEX idx_projet_id (projet_id),
            INDEX idx_categorie (categorie),
            INDEX idx_uploaded_by (uploaded_by)
          )
        `
      },
      {
        name: 'projet_prestataires',
        sql: `
          CREATE TABLE IF NOT EXISTS projet_prestataires (
            id INT PRIMARY KEY AUTO_INCREMENT,
            projet_id INT NOT NULL,
            prestataire_id INT NOT NULL,
            role_prestataire VARCHAR(255),
            date_debut DATE,
            date_fin DATE,
            statut ENUM('Actif', 'Terminé', 'Suspendu') DEFAULT 'Actif',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
            FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE,
            UNIQUE KEY unique_projet_prestataire (projet_id, prestataire_id),
            INDEX idx_projet_id (projet_id),
            INDEX idx_prestataire_id (prestataire_id)
          )
        `
      },
      {
        name: 'budget_details',
        sql: `
          CREATE TABLE IF NOT EXISTS budget_details (
            id INT PRIMARY KEY AUTO_INCREMENT,
            projet_id INT NOT NULL,
            phase_id INT,
            contrat_id INT,
            categorie ENUM('Personnel', 'Matériel', 'Logiciel', 'Formation', 'Prestation', 'Autre') NOT NULL,
            intitule VARCHAR(255) NOT NULL,
            montant_prevu DECIMAL(15,2) DEFAULT 0,
            montant_consomme DECIMAL(15,2) DEFAULT 0,
            date_prevue DATE,
            date_reelle DATE,
            statut ENUM('Planifié', 'Engagé', 'Facturé', 'Payé') DEFAULT 'Planifié',
            commentaires TEXT,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (projet_id) REFERENCES projets(id) ON DELETE CASCADE,
            FOREIGN KEY (phase_id) REFERENCES phases_projet(id) ON DELETE SET NULL,
            FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES utilisateurs(id),
            INDEX idx_projet_id (projet_id),
            INDEX idx_categorie (categorie)
          )
        `
      }
    ];

    let createdCount = 0;
    for (const table of tables) {
      try {
        await this.connection.execute(table.sql);
        console.log(`✅ Table "${table.name}" créée/vérifiée`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Erreur création table "${table.name}":`, error.message);
        this.errors.push(`Création table ${table.name} échouée`);
      }
    }

    return createdCount === tables.length;
  }

  async enhanceExistingTables() {
    console.log('\n🔧 Amélioration des tables existantes...');

    const enhancements = [
      {
        name: 'Ajout colonne code dans projets',
        sql: `ALTER TABLE projets ADD COLUMN IF NOT EXISTS code VARCHAR(50) UNIQUE AFTER nom`
      },
      {
        name: 'Ajout colonnes santé projet',
        sql: `ALTER TABLE projets 
              ADD COLUMN IF NOT EXISTS risque_niveau ENUM('Faible', 'Moyen', 'Élevé', 'Critique') DEFAULT 'Moyen',
              ADD COLUMN IF NOT EXISTS sante_projet ENUM('Vert', 'Orange', 'Rouge') DEFAULT 'Vert'`
      },
      {
        name: 'Ajout colonnes budget avancé',
        sql: `ALTER TABLE projets 
              ADD COLUMN IF NOT EXISTS budget_consomme DECIMAL(15,2) DEFAULT 0,
              ADD COLUMN IF NOT EXISTS nb_phases INT DEFAULT 0,
              ADD COLUMN IF NOT EXISTS nb_livrables INT DEFAULT 0`
      }
    ];

    let enhancedCount = 0;
    for (const enhancement of enhancements) {
      try {
        await this.connection.execute(enhancement.sql);
        console.log(`✅ ${enhancement.name} - fait`);
        enhancedCount++;
      } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
          console.log(`⚠️ ${enhancement.name} - déjà fait ou erreur:`, error.message);
        } else {
          console.log(`✅ ${enhancement.name} - déjà fait`);
          enhancedCount++;
        }
      }
    }

    return enhancedCount > 0;
  }

  async createSampleData() {
    console.log('\n📊 Création des données de test...');

    try {
      // Insérer des prestataires de test
      await this.connection.execute(`
        INSERT IGNORE INTO prestataires (nom, siret, contact_nom, contact_email, domaine_expertise) VALUES
        ('TechConsult SA', '12345678901234', 'Jean Dupont', 'contact@techconsult.fr', 'Développement logiciel'),
        ('InnoSoft SARL', '56789012345678', 'Marie Martin', 'info@innosoft.fr', 'Infrastructure IT'),
        ('DataPro Consulting', '98765432109876', 'Pierre Durand', 'contact@datapro.fr', 'Analyse de données'),
        ('WebFactory', '11223344556677', 'Sophie Laurent', 'hello@webfactory.fr', 'Développement web'),
        ('SecurIT Corp', '99887766554433', 'Thomas Petit', 'contact@securit.fr', 'Cybersécurité')
      `);
      console.log('✅ Prestataires de test créés');

      // Ajouter des codes aux projets existants s'ils n'en ont pas
      const [existingProjects] = await this.connection.execute(`
        SELECT id, nom FROM projets WHERE code IS NULL OR code = ''
      `);

      for (const project of existingProjects) {
        const code = `PROJ-${project.id.toString().padStart(3, '0')}`;
        await this.connection.execute(`
          UPDATE projets SET code = ? WHERE id = ?
        `, [code, project.id]);
      }

      if (existingProjects.length > 0) {
        console.log(`✅ Codes ajoutés à ${existingProjects.length} projets existants`);
      }

      // Créer des phases pour les projets existants
      const [projects] = await this.connection.execute('SELECT id FROM projets LIMIT 3');
      
      for (const project of projects) {
        await this.connection.execute(`
          INSERT IGNORE INTO phases_projet (projet_id, nom, description, statut, ordre) VALUES
          (?, 'Cadrage', 'Phase de cadrage et définition des besoins', 'Terminée', 1),
          (?, 'Consultation', 'Consultation des prestataires', 'En cours', 2),
          (?, 'Contractualisation', 'Signature des contrats', 'Planifiée', 3),
          (?, 'Exécution', 'Réalisation du projet', 'Planifiée', 4),
          (?, 'Recette', 'Tests et validation', 'Planifiée', 5)
        `, [project.id, project.id, project.id, project.id, project.id]);
      }

      if (projects.length > 0) {
        console.log(`✅ Phases de test créées pour ${projects.length} projets`);
      }

      return true;
    } catch (error) {
      console.error('❌ Erreur création données de test:', error.message);
      return false;
    }
  }

  async createDirectories() {
    console.log('\n📁 Création des répertoires nécessaires...');

    const directories = [
      path.join(__dirname, '../uploads'),
      path.join(__dirname, '../uploads/documents'),
      path.join(__dirname, '../uploads/contracts'),
      path.join(__dirname, '../uploads/deliverables'),
      path.join(__dirname, '../logs'),
      path.join(__dirname, '../reports')
    ];

    let createdCount = 0;
    for (const dir of directories) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✅ Répertoire créé: ${path.relative(__dirname, dir)}`);
          createdCount++;
        } else {
          console.log(`✅ Répertoire existe: ${path.relative(__dirname, dir)}`);
        }
      } catch (error) {
        console.error(`❌ Erreur création répertoire ${dir}:`, error.message);
        this.errors.push(`Création répertoire ${dir} échouée`);
      }
    }

    return createdCount >= 0;
  }

  async verifyInstallation() {
    console.log('\n🔍 Vérification de l\'installation...');

    try {
      // Vérifier que toutes les nouvelles tables existent
      const newTables = ['prestataires', 'phases_projet', 'contrats', 'livrables', 'documents_projet', 'projet_prestataires', 'budget_details'];
      
      for (const table of newTables) {
        const [rows] = await this.connection.execute(`SHOW TABLES LIKE '${table}'`);
        if (rows.length === 0) {
          this.errors.push(`Table ${table} non créée`);
        } else {
          console.log(`✅ Table ${table} vérifiée`);
        }
      }

      // Vérifier les données de test
      const [prestataires] = await this.connection.execute('SELECT COUNT(*) as count FROM prestataires');
      const [phases] = await this.connection.execute('SELECT COUNT(*) as count FROM phases_projet');

      console.log(`✅ ${prestataires[0].count} prestataires en base`);
      console.log(`✅ ${phases[0].count} phases en base`);

      return this.errors.length === 0;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification:', error.message);
      return false;
    }
  }

  async cleanup() {
    if (this.connection) {
      await this.connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }

  async install() {
    console.log('🚀 INSTALLATION DES NOUVELLES FONCTIONNALITÉS');
    console.log('=' * 50);

    try {
      // Étape 1: Connexion
      if (!(await this.connect())) {
        return false;
      }

      // Étape 2: Vérification des prérequis
      if (!(await this.checkPrerequisites())) {
        console.log('\n❌ Prérequis non satisfaits. Installation interrompue.');
        return false;
      }

      // Étape 3: Installation des dépendances npm
      await this.installDependencies();

      // Étape 4: Création des tables
      if (!(await this.createTables())) {
        console.log('\n❌ Erreur lors de la création des tables.');
        return false;
      }

      // Étape 5: Amélioration des tables existantes
      await this.enhanceExistingTables();

      // Étape 6: Création des répertoires
      if (!(await this.createDirectories())) {
        console.log('\n❌ Erreur lors de la création des répertoires.');
        return false;
      }

      // Étape 7: Données de test
      await this.createSampleData();

      // Étape 8: Vérification finale
      if (!(await this.verifyInstallation())) {
        console.log('\n❌ Vérification de l\'installation échouée.');
        return false;
      }

      console.log('\n🎉 INSTALLATION TERMINÉE AVEC SUCCÈS !');
      console.log('\n📋 Nouvelles fonctionnalités disponibles :');
      console.log('   ✅ Gestion des phases de projet');
      console.log('   ✅ Gestion des prestataires');
      console.log('   ✅ Gestion des contrats');
      console.log('   ✅ Gestion des livrables');
      console.log('   ✅ Gestion documentaire');
      console.log('   ✅ Suivi budgétaire avancé');
      console.log('   ✅ Rapports et exports PMO');
      console.log('   ✅ Dashboard avancé');

      console.log('\n🔄 Pour démarrer avec les nouvelles fonctionnalités :');
      console.log('   1. Redémarrez le serveur backend');
      console.log('   2. Connectez-vous en tant que PMO ou Admin');
      console.log('   3. Explorez les nouveaux onglets dans la gestion de projet');

      return true;

    } catch (error) {
      console.error('\n❌ Erreur critique durant l\'installation:', error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Exécuter l'installation
if (require.main === module) {
  const installer = new FeatureInstaller();
  installer.install().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = FeatureInstaller;