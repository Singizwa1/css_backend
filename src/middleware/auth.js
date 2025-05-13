
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


const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};


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

const canDeleteComplaint = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'customer_relations_officer') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. You are not allowed to delete complaints.' });
};


module.exports = {
  authenticateToken,
  isAdmin,
  isCustomerRelationsOfficer,
  isComplaintsHandler,
  canDeleteComplaint,
  
};