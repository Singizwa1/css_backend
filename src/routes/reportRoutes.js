// src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getComplaintsByCategory, 
  getResolutionTimeByDepartment, 
  getComplaintStatusDistribution,
  getMonthlyComplaintTrend,
  getDepartmentPerformance
} = require('../controllers/reportController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticateToken, isAdmin);

// Get complaints by category
router.get('/complaints-by-category', getComplaintsByCategory);

// Get resolution time by department
router.get('/resolution-time-by-department', getResolutionTimeByDepartment);

// Get complaint status distribution
router.get('/complaint-status-distribution', getComplaintStatusDistribution);

// Get monthly complaint trend
router.get('/monthly-complaint-trend', getMonthlyComplaintTrend);

// Get department performance
router.get('/department-performance', getDepartmentPerformance);

module.exports = router;