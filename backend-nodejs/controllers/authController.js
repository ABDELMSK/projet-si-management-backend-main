// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthController {
  // Connexion utilisateur
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validation des données
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email et mot de passe requis'
        });
      }

      // Trouver l'utilisateur
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // Vérifier le mot de passe
      const isPasswordValid = await User.verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Email ou mot de passe incorrect'
        });
      }

      // Mettre à jour le dernier accès
      await User.updateLastAccess(user.id);

      // Générer le token JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          role: user.role_nom 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // Retourner les données utilisateur (sans le mot de passe)
      const { password_hash, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Connexion réussie',
        token,
        user: userWithoutPassword
      });

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la connexion'
      });
    }
  }

  // Récupérer les informations de l'utilisateur connecté
  static async getMe(req, res) {
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
        user: userWithoutPassword
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

  // Déconnexion
  static async logout(req, res) {
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  }
}

module.exports = AuthController;