
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

// Middleware to check if user is customer relations officer
const isCustomerRelationsOfficer = (req, res, next) => {
  if (req.user.role !== 'customer_relations_officer') {
    return res.status(403).json({ message: 'Access denied. Customer Relations Officer role required.' });
  }
  next();
};

// Middleware to check if user is complaints handler
const isComplaintsHandler = (req, res, next) => {
  if (req.user.role !== 'complaints_handler') {
    return res.status(403).json({ message: 'Access denied. Complaints Handler role required.' });
  }
  next();
};


module.exports = {
  authenticateToken,
  isAdmin,
  isCustomerRelationsOfficer,
  isComplaintsHandler,
  
};