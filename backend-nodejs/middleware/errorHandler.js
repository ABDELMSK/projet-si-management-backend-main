// middleware/errorHandler.js
// Middleware de gestion d'erreurs globale
const errorHandler = (err, req, res, next) => {
  console.error('Erreur non gérée:', err);

  // Erreur de validation MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      message: 'Cette valeur existe déjà'
    });
  }

  // Erreur de clé étrangère
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Référence invalide'
    });
  }

  // Erreur de connexion à la base de données
  if (err.code === 'ECONNREFUSED') {
    return res.status(500).json({
      success: false,
      message: 'Erreur de connexion à la base de données'
    });
  }

  // Erreur par défaut
  res.status(500).json({
    success: false,
    message: 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Middleware pour les routes non trouvées
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} non trouvée`
  });
};

module.exports = {
  errorHandler,
  notFound
};