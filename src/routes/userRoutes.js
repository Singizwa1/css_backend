const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
} = require('../controllers/userController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const allowAdminOrSelf = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.id === parseInt(req.params.id)) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied' });
};

// Auth middleware
router.use(authenticateToken);

// Routes
router.get('/', isAdmin, getAllUsers);
router.post('/', isAdmin, createUser);
router.delete('/:id', isAdmin, deleteUser);

router.put('/change-password', changePassword);

router.get('/:id', allowAdminOrSelf, getUserById);
router.put('/:id', allowAdminOrSelf, updateUser);

module.exports = router;
