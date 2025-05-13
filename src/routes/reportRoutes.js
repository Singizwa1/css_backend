// src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getComplaintsByCategory, 
  getResolutionTimeByDepartment, 
  getComplaintStatusDistribution,
  getMonthlyComplaintTrend,
  getDepartmentPerformance,
  getWeeklyComplaints
} = require('../controllers/reportController');
const { authenticateToken, isAdmin } = require('../middleware/auth');


router.use(authenticateToken, isAdmin);

router.get('/complaints-by-category', getComplaintsByCategory);

router.get('/resolution-time-by-department', getResolutionTimeByDepartment);
router.get('/complaint-status-distribution', getComplaintStatusDistribution);

router.get('/monthly-complaint-trend', getMonthlyComplaintTrend);

router.get('/department-performance', getDepartmentPerformance);
router.get("/weekly-complaints",getWeeklyComplaints);

module.exports = router;