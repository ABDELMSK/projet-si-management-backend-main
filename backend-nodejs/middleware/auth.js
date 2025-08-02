// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'accès requis'
      });
    }

    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier que l'utilisateur existe toujours et récupérer ses informations complètes
    const user = await User.findById(decoded.userId);
    if (!user || user.statut !== 'Actif') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou utilisateur inactif'
      });
    }

    // Ajouter les informations utilisateur complètes à la requête
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      fullUser: user // Informations complètes de l'utilisateur
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expiré'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    console.error('Erreur d\'authentification:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur d\'authentification'
    });
  }
};

// Middleware pour vérifier les permissions spécifiques
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = req.user.fullUser;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // L'administrateur fonctionnel a tous les droits
      if (user.role_nom === 'Administrateur fonctionnel') {
        return next();
      }

      // Parser les permissions JSON
      let permissions = {};
      try {
        permissions = JSON.parse(user.permissions || '{}');
      } catch (e) {
        permissions = {};
      }

      // Vérifier la permission spécifique
      if (!permissions[requiredPermission]) {
        return res.status(403).json({
          success: false,
          message: `Permission insuffisante. Vous devez être administrateur pour ${requiredPermission}`,
          required_permission: requiredPermission,
          user_role: user.role_nom
        });
      }

      next();
    } catch (error) {
      console.error('Erreur de vérification des permissions:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  };
};

// Middleware spécifiques pour chaque action
const canManageUsers = (req, res, next) => {
  const user = req.user.fullUser;
  
  if (user.role_nom !== 'Administrateur fonctionnel') {
    return res.status(403).json({
      success: false,
      message: 'Seuls les administrateurs peuvent gérer les utilisateurs',
      user_role: user.role_nom,
      required_role: 'Administrateur fonctionnel'
    });
  }
  
  next();
};

const canCreateProject = (req, res, next) => {
  const user = req.user.fullUser;
  
  if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
    return res.status(403).json({
      success: false,
      message: 'Seuls les administrateurs et PMO peuvent créer des projets',
      user_role: user.role_nom,
      required_roles: ['Administrateur fonctionnel', 'PMO / Directeur de projets']
    });
  }
  
  next();
};

const canViewAllProjects = (req, res, next) => {
  const user = req.user.fullUser;
  
  if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
    return res.status(403).json({
      success: false,
      message: 'Permission insuffisante pour voir tous les projets',
      user_role: user.role_nom
    });
  }
  
  next();
};
const canManageProjectPhases = (req, res, next) => {
  const user = req.user.fullUser;
  const projectId = req.params.id;
  
  // Chef de projet peut gérer les phases de ses projets
  // PMO/Admin peuvent gérer toutes les phases
  if (['Chef de Projet'].includes(user.role_nom)) {
    // Vérifier si c'est son projet
    return checkProjectOwnership(projectId, user.id, next);
  }
  
  if (['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(user.role_nom)) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Permission insuffisante pour gérer les phases'
  });
};

const canUploadDocuments = (req, res, next) => {
  const user = req.user.fullUser;
  
  // Tous les utilisateurs connectés peuvent uploader des documents
  // mais uniquement sur leurs projets (Chef) ou tous (PMO/Admin)
  next();
};

const canManageContracts = (req, res, next) => {
  const user = req.user.fullUser;
  
  // Seuls Chef de projet, PMO et Admin peuvent gérer les contrats
  if (!['Chef de Projet', 'PMO / Directeur de projets', 'Administrateur fonctionnel'].includes(user.role_nom)) {
    return res.status(403).json({
      success: false,
      message: 'Permission insuffisante pour gérer les contrats'
    });
  }
  
  next();
};
module.exports = {
  authenticateToken,
  checkPermission,
  canManageUsers,
  canCreateProject,
  canViewAllProjects,
  canManageProjectPhases,
  canManageContracts,
  canUploadDocuments
};