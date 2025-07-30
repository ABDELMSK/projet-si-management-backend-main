// routes/users.js
const express = require('express');
const router = express.Router();
const { authenticateToken, canManageUsers } = require('../middleware/auth');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// GET /api/users - Récupérer tous les utilisateurs (ADMIN SEULEMENT)
router.get('/', authenticateToken, canManageUsers, async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    
    let users;
    if (search) {
      users = await User.search(search);
    } else {
      users = await User.findAll(parseInt(limit), parseInt(offset));
    }

    res.json({
      success: true,
      data: users,
      count: users.length,
      message: `${users.length} utilisateurs récupérés`
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des utilisateurs'
    });
  }
});

// GET /api/users/:id - Récupérer un utilisateur par ID (ADMIN SEULEMENT)
router.get('/:id', authenticateToken, canManageUsers, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const { password_hash, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// POST /api/users - Créer un nouvel utilisateur (ADMIN SEULEMENT)
router.post('/', authenticateToken, canManageUsers, async (req, res) => {
  try {
    const { nom, email, password, role_id, direction_id } = req.body;

    // Validation des données
    if (!nom || !email || !password || !role_id || !direction_id) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis (nom, email, password, role_id, direction_id)'
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Créer l'utilisateur
    const userId = await User.create({
      nom,
      email,
      password,
      role_id: parseInt(role_id),
      direction_id: parseInt(direction_id)
    });

    // Log de l'action pour audit
    console.log(`✅ Nouvel utilisateur créé par ${req.user.email}: ${email} (ID: ${userId})`);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: { id: userId }
    });

  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création'
    });
  }
});

// PUT /api/users/:id - Mettre à jour un utilisateur (ADMIN SEULEMENT)
router.put('/:id', authenticateToken, canManageUsers, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Si le mot de passe est fourni, le hasher
    if (updateData.password) {
      const saltRounds = 10;
      updateData.password_hash = await bcrypt.hash(updateData.password, saltRounds);
      delete updateData.password; // Supprimer le mot de passe en clair
    }

    // Mettre à jour
    const updated = await User.update(id, updateData);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification apportée'
      });
    }

    // Log de l'action pour audit
    console.log(`✅ Utilisateur ${id} mis à jour par ${req.user.email}`);

    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// DELETE /api/users/:id - Supprimer un utilisateur (ADMIN SEULEMENT)
router.delete('/:id', authenticateToken, canManageUsers, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si l'utilisateur existe
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Empêcher la suppression de son propre compte
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    // Supprimer (soft delete)
    const deleted = await User.delete(id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    // Log de l'action pour audit
    console.log(`⚠️ Utilisateur ${user.nom} (${user.email}) supprimé par ${req.user.email}`);

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/users/me/profile - Récupérer son propre profil (Tous les utilisateurs connectés)
router.get('/me/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const { password_hash, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});
router.post('/', authenticateToken, canManageUsers, async (req, res) => {
  try {
    const { nom, email, password, role_id, direction_id } = req.body;

    // Validation des données
    if (!nom || !email || !password || !role_id || !direction_id) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà'
      });
    }

    // Hasher le mot de passe
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const userId = await User.create({
      nom,
      email,
      password_hash,
      role_id,
      direction_id,
      statut: 'Actif'
    });

    // Récupérer l'utilisateur créé avec toutes les informations
    const newUser = await User.findById(userId);
    
    // Supprimer le hash du mot de passe dans la réponse
    const { password_hash: _, ...userWithoutPassword } = newUser;

    // Log pour audit
    console.log(`✅ Nouvel utilisateur créé par ${req.user.email}: ${nom} (${email})`);

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création'
    });
  }
});

// PUT /api/users/:id/password - Changer le mot de passe d'un utilisateur (ADMIN SEULEMENT)
router.put('/:id/password', authenticateToken, canManageUsers, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe est requis'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Vérifier si l'utilisateur existe
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Hasher le nouveau mot de passe
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Mettre à jour le mot de passe
    const updated = await User.update(id, { password_hash });
    
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Erreur lors de la mise à jour du mot de passe'
      });
    }

    // Log pour audit
    console.log(`🔒 Mot de passe changé pour l'utilisateur ${user.nom} par ${req.user.email}`);

    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;