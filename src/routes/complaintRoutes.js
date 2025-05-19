const express = require('express');
const router = express.Router();
const {
  getAllComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  deleteComplaint,
 
} = require('../controllers/complaintController');
const {
  authenticateToken,
isCustomerRelationsOfficer,
  
  canDeleteComplaint
} = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getAllComplaints);                   
router.get('/:id', getComplaintById);                
router.post('/', isCustomerRelationsOfficer, createComplaint); 
router.put('/:id', updateComplaint);             
router.delete('/:id', canDeleteComplaint, deleteComplaint); 
module.exports = router;