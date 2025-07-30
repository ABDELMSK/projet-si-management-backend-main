// models/User.js
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Créer un nouvel utilisateur
  static async create(userData) {
    const { nom, email, password, role_id, direction_id } = userData;
    
    // Hasher le mot de passe
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const sql = `
      INSERT INTO utilisateurs (nom, email, password_hash, role_id, direction_id, statut) 
      VALUES (?, ?, ?, ?, ?, 'Actif')
    `;
    
    const result = await query(sql, [nom, email, password_hash, role_id, direction_id]);
    return result.insertId;
  }

  // Trouver un utilisateur par email
  static async findByEmail(email) {
    const sql = `
      SELECT u.*, r.nom as role_nom, d.nom as direction_nom, r.permissions
      FROM utilisateurs u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN directions d ON u.direction_id = d.id
      WHERE u.email = ? AND u.statut = 'Actif'
    `;
    
    const results = await query(sql, [email]);
    return results[0] || null;
  }

  // Trouver un utilisateur par ID
  static async findById(id) {
    const sql = `
      SELECT u.*, r.nom as role_nom, d.nom as direction_nom, r.permissions
      FROM utilisateurs u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN directions d ON u.direction_id = d.id
      WHERE u.id = ?
    `;
    
    const results = await query(sql, [id]);
    return results[0] || null;
  }

  // Récupérer tous les utilisateurs
  static async findAll(limit = 50, offset = 0) {
    const sql = `
      SELECT u.id, u.nom, u.email, u.statut, u.dernier_acces, u.created_at,
             r.nom as role_nom, d.nom as direction_nom
      FROM utilisateurs u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN directions d ON u.direction_id = d.id
      ORDER BY u.nom ASC
      LIMIT ? OFFSET ?
    `;
    
    return await query(sql, [limit, offset]);
  }

  // Rechercher des utilisateurs
  static async search(searchTerm) {
    const sql = `
      SELECT u.id, u.nom, u.email, u.statut, u.dernier_acces, u.created_at,
             r.nom as role_nom, d.nom as direction_nom
      FROM utilisateurs u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN directions d ON u.direction_id = d.id
      WHERE (u.nom LIKE ? OR u.email LIKE ?)
      ORDER BY u.nom ASC
    `;
    
    const searchPattern = `%${searchTerm}%`;
    return await query(sql, [searchPattern, searchPattern]);
  }

  // Mettre à jour le dernier accès
  static async updateLastAccess(userId) {
    const sql = 'UPDATE utilisateurs SET dernier_acces = NOW() WHERE id = ?';
    return await query(sql, [userId]);
  }

  // Vérifier le mot de passe
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Mettre à jour un utilisateur
  static async update(id, userData) {
    const fields = [];
    const values = [];
    
    // Construire la requête dynamiquement
    Object.keys(userData).forEach(key => {
      if (userData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(userData[key]);
      }
    });
    
    if (fields.length === 0) return false;
    
    values.push(id);
    const sql = `UPDATE utilisateurs SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const result = await query(sql, values);
    return result.affectedRows > 0;
  }

  // Supprimer un utilisateur (soft delete)
  static async delete(id) {
    const sql = 'UPDATE utilisateurs SET statut = "Inactif", updated_at = NOW() WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Statistiques des utilisateurs
  static async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_utilisateurs,
        COUNT(CASE WHEN statut = 'Actif' THEN 1 END) as utilisateurs_actifs,
        COUNT(CASE WHEN r.nom = 'Chef de Projet' THEN 1 END) as chefs_projet,
        COUNT(CASE WHEN r.nom = 'PMO / Directeur de projets' THEN 1 END) as pmo,
        COUNT(CASE WHEN r.nom = 'Administrateur fonctionnel' THEN 1 END) as admins
      FROM utilisateurs u
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    
    const results = await query(sql);
    return results[0];
  }

  // Vérifier si un email existe déjà
  static async emailExists(email, excludeId = null) {
    let sql = 'SELECT id FROM utilisateurs WHERE email = ?';
    let params = [email];
    
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    
    const results = await query(sql, params);
    return results.length > 0;
  }
}

module.exports = User;