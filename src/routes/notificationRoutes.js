// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getNotifications, 
  markAllAsRead, 
  markAsRead, 
  deleteNotification,
  getUnreadCount
} = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all notifications for the current user
router.get('/', getNotifications);

// Get unread notification count
router.get('/unread-count', getUnreadCount);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Mark a single notification as read
router.put('/:id/read', markAsRead);

// Delete a notification
router.delete('/:id', deleteNotification);

module.exports = router;