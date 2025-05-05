
const express = require('express');
const authRouter = express.Router();
const { login, getCurrentUser } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Login route
authRouter.post('/login', login);

// Get current user
authRouter.get('/me', authenticateToken, getCurrentUser);

module.exports = authRouter;