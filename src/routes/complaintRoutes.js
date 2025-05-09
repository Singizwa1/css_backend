const express = require('express');
const router = express.Router();
const { 
  getAllComplaints, 
  getComplaintById, 
  createComplaint, 
  updateComplaint, 
  deleteComplaint 
} = require('../controllers/complaintController');
const { authenticateToken, isAdmin, isCustomerRelationsOfficer } = require('../middleware/auth');

// Authenticate all routes
router.use(authenticateToken);

// Complaint routes
router.get('/', getAllComplaints);
router.get('/:id', getComplaintById);

// No longer using multer's upload.array()
router.post('/', isCustomerRelationsOfficer, createComplaint);

router.put('/:id', updateComplaint);
router.delete('/:id', isAdmin, deleteComplaint);

module.exports = router;
