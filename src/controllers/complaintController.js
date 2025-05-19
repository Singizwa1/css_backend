const pool = require("../config/db")
const formidable = require('formidable');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const emailService = require("../utils/emailService");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

require('dotenv').config(); 


exports.getAllComplaints = async (req, res) => {
  try {
    let query = ""
    let params = []

    
    if (req.user.role === "customer_relations_officer") {
      query = `
        SELECT c.*, u.id AS assigned_user_id, u.name AS assigned_user_name, u.department AS assigned_user_department
        FROM complaints c
        LEFT JOIN users u ON c.assigned_to = u.id
        ORDER BY c.date DESC
      `
    } else if (req.user.role === "complaints_handler") {
      query = `
        SELECT c.*, u.id AS assigned_user_id, u.name AS assigned_user_name, u.department AS assigned_user_department
        FROM complaints c
        LEFT JOIN users u ON c.assigned_to = u.id
        WHERE c.assigned_to = ?
        ORDER BY c.date DESC
      `
      params = [req.user.id]
    } else if (req.user.role === "admin") {
      query = `
        SELECT c.*, u.id AS assigned_user_id, u.name AS assigned_user_name, u.department AS assigned_user_department
        FROM complaints c
        LEFT JOIN users u ON c.assigned_to = u.id
        ORDER BY c.date DESC
      `
    } else {
      return res.status(403).json({ message: "Access denied" })
    }

    const [complaints] = await pool.query(query, params)

    for (const complaint of complaints) {
      if (complaint.assigned_user_id) {
        complaint.assignedToUser = {
          id: complaint.assigned_user_id,
          name: complaint.assigned_user_name,
          department: complaint.assigned_user_department,
        }
      } else {
        complaint.assignedToUser = null
      }

      delete complaint.assigned_user_id
      delete complaint.assigned_user_name
      delete complaint.assigned_user_department

    
      const [attachments] = await pool.query(
        "SELECT id, filename, original_filename, file_type, file_size, file_url FROM attachments WHERE complaint_id = ?",
        [complaint.id],
      )
      complaint.attachments = attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.original_filename,
        type: attachment.file_type,
        size: attachment.file_size,
        url: attachment.file_url,
      }))
    }

    res.json(complaints)
  } catch (error) {
    console.error("Get complaints error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Get complaint by ID
exports.getComplaintById = async (req, res) => {
  try {
    const { id } = req.params

    const [complaints] = await pool.query("SELECT * FROM complaints WHERE id = ?", [id])

    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found" })
    }

    const complaint = complaints[0]

    // Check if user has access to this complaint
    if (
      req.user.role === "complaints_handler" &&
      complaint.assigned_to !== req.user.id &&
      req.user.role !== "admin" &&
      complaint.created_by !== req.user.id
    ) {
      return res.status(403).json({ message: "Access denied" })
    }

    
    const [attachments] = await pool.query(
      "SELECT id, filename, original_filename, file_type, file_size, file_url FROM attachments WHERE complaint_id = ?",
      [id],
    )

    complaint.attachments = attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.original_filename,
      type: attachment.file_type,
      size: attachment.file_size,
      url: attachment.file_url,
    }))

    const [assignedTo] = await pool.query("SELECT id, name, department FROM users WHERE id = ?", [
      complaint.assigned_to,
    ])

    if (assignedTo.length > 0) {
      complaint.assignedToUser = {
        id: assignedTo[0].id,
        name: assignedTo[0].name,
        department: assignedTo[0].department,
      }
    }

    const [createdBy] = await pool.query("SELECT id, name FROM users WHERE id = ?", [complaint.created_by])

    if (createdBy.length > 0) {
      complaint.createdByUser = {
        id: createdBy[0].id,
        name: createdBy[0].name,
      }
    }

    res.json(complaint)
  } catch (error) {
    console.error("Get complaint error:", error)
    res.status(500).json({ message: "Server error" })
  }
}


exports.createComplaint = async (req, res) => {
  const form = new formidable.Formidable();
  form.multiples = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return res.status(400).json({ message: 'Error parsing form data' });
    }

    try {
      if (req.user.role !== 'customer_relations_officer') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const customerName = fields.customerName?.[0] || "";
      const customerPhone = fields.customerPhone?.[0] || "";
      const channel = fields.channel?.[0] || "";
      const inquiryType = fields.inquiryType?.[0] || "";
      const details = fields.details?.[0] || "";
      const attemptedResolution = fields.attemptedResolution?.[0] === "1";
      const resolutionDetails = fields.resolutionDetails?.[0] || "";
      const forwardTo = fields.forwardTo?.[0] || null;

      // === Validation ===
      if (!customerName.trim() || !customerPhone.trim() || !inquiryType.trim() || !details.trim()) {
        return res.status(400).json({ message: 'All required fields must be filled out.' });
      }

      const uploadedFiles = Array.isArray(files.files)
        ? files.files
        : files.files
        ? [files.files]
        : [];

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ message: 'At least one attachment is required.' });
      }

      const maxFileSize = 10 * 1024 * 1024;
      const allowedTypes = [
        'image/png',
        'image/jpeg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      for (const file of uploadedFiles) {
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ message: `Unsupported file type: ${file.mimetype}` });
        }
        if (file.size > maxFileSize) {
          return res.status(400).json({ message: `File too large: ${file.originalFilename}` });
        }
      }

      // === Assignment Logic ===
      let assignedTo;
      if (forwardTo) {
        const [departments] = await pool.query(
          'SELECT id FROM users WHERE department = ? AND role = "complaints_handler" LIMIT 1',
          [forwardTo.trim()]
        );

        if (departments.length === 0) {
          return res.status(400).json({ message: 'Selected department not found' });
        }

        assignedTo = departments[0].id;
      } else {
        const inquiryMap = {
          'Technical Issue': 'IT Department',
          'Forgotten Password': 'IT Department',
          'Payment Delay': 'Funds Administration',
          'Financial Transaction': 'Funds Administration',
          'Repurchase Issue': 'Finance & Accounting',
          'Financial Approval': 'Finance & Accounting',
        };

        const department = inquiryMap[inquiryType.trim()] || 'IT Department';

        const [handlers] = await pool.query(
          'SELECT id FROM users WHERE department = ? AND role = "complaints_handler" LIMIT 1',
          [department]
        );

        if (handlers.length === 0) {
          return res.status(400).json({ message: 'No handler available for this department.' });
        }

        assignedTo = handlers[0].id;
      }

      // === Insert Complaint ===
      const [result] = await pool.query(
        `INSERT INTO complaints (
          customer_name,
          customer_phone,
          channel,
          inquiry_type,
          details,
          status,
          assigned_to,
          created_by,
          attempted_resolution,
          resolution_details,
          forwarded_from
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerName.trim(),
          customerPhone.trim(),
          channel?.trim() || null,
          inquiryType.trim(),
          details.trim(),
          'Pending',
          assignedTo,
          req.user.id,
          attemptedResolution ? 1 : 0,
          resolutionDetails?.trim() || null,
          forwardTo ? req.user.id : null,
        ]
      );

      const complaintId = result.insertId;

      // === Upload Files to Cloudinary ===
      for (const file of uploadedFiles) {
        const originalName = file.originalFilename.replace(/\.[^/.]+$/, '');
        const ext = file.originalFilename.split('.').pop();
        const publicId = `complaints/${uuidv4()}-${originalName}`;

        let resourceType = file.mimetype.startsWith('image/')
          ? 'image'
          : 'raw';

        const uploadResult = await cloudinary.uploader.upload(file.filepath, {
          resource_type: resourceType,
          public_id: publicId,
          use_filename: true,
          unique_filename: false,
        });

        await pool.query(
          `INSERT INTO attachments (
            complaint_id,
            filename,
            original_filename,
            file_type,
            file_size,
            file_url
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            complaintId,
            publicId,
            file.originalFilename,
            file.mimetype,
            file.size,
            uploadResult.secure_url,
          ]
        );

        // Delete temp file
        fs.unlink(file.filepath, (err) => {
          if (err) console.error("File cleanup error:", err);
        });
      }

      // === Notify Assigned Handler ===
      const [handlerRow] = await pool.query(
        "SELECT name, email, department FROM users WHERE id = ?",
        [assignedTo]
      );

      if (handlerRow.length > 0) {
        const handler = handlerRow[0];

        await emailService.notifyHandlerAssignment({
          handlerEmail: handler.email,
          handlerName: handler.name,
          complaintId,
          customerName,
          inquiryType,
          department: handler.department,
        });
      }

      return res.status(201).json({ message: 'Complaint submitted successfully', complaintId });
    } catch (error) {
      console.error('Create complaint error:', error);

      // Cleanup files if error occurs
      const uploadedFiles = Array.isArray(files.files)
        ? files.files
        : files.files
        ? [files.files]
        : [];

      for (const file of uploadedFiles) {
        if (file?.filepath) {
          fs.unlink(file.filepath, (err) => {
            if (err) console.error("Error cleaning up temp file:", err);
          });
        }
      }

      return res.status(500).json({ message: 'Server error' });
    }
  });
};


exports.updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, forwardTo } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    if (status === "Resolved" && !resolution) {
      return res.status(400).json({ message: "Resolution details are required when status is Resolved" });
    }

    const [complaints] = await pool.query("SELECT * FROM complaints WHERE id = ?", [id]);

    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const complaint = complaints[0];

    // Access control
    if (
      req.user.role === "complaints_handler" &&
      complaint.assigned_to !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "customer_relations_officer"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Update logic
    if (req.user.role === "customer_relations_officer" && status === "Resolved") {
      // CRO resolves and unassigns
      await pool.query(
        `UPDATE complaints 
         SET status = ?, resolution = ?, updated_at = NOW(), assigned_to = NULL 
         WHERE id = ?`,
        [status, resolution, id]
      );
    } else if (forwardTo) {
      // Forwarding logic
      await pool.query(
        `UPDATE complaints 
         SET status = ?, resolution = ?, updated_at = NOW(), assigned_to = ? 
         WHERE id = ?`,
        [status, resolution || null, forwardTo, id]
      );
    } else {
      // Generic update
      await pool.query(
        `UPDATE complaints 
         SET status = ?, resolution = ?, updated_at = NOW() 
         WHERE id = ?`,
        [status, resolution || null, id]
      );
    }

    // Get current user's department
    const [userDetails] = await pool.query("SELECT department FROM users WHERE id = ?", [req.user.id]);
    const userDepartment = userDetails.length > 0 ? userDetails[0].department : "Department";

    // Insert system notification
    if (status === "Resolved") {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, \`read\`) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          complaint.created_by,
          "Complaint Resolved",
          `Complaint #${id} has been resolved by ${userDepartment}.`,
          "resolution",
          0,
        ]
      );
    } else if (status === "In Progress" && complaint.status === "Pending") {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, \`read\`) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          complaint.created_by,
          "Complaint Updated",
          `Complaint #${id} status updated to In Progress.`,
          "update",
          0,
        ]
      );
    }

    // Email: get creator info
    const [creatorRow] = await pool.query(
      "SELECT email, name FROM users WHERE id = ?",
      [complaint.created_by]
    );

    // Email: get department
    const [deptRow] = await pool.query(
      "SELECT department FROM users WHERE id = ?",
      [req.user.id]
    );

    // Send email notification to complaint creator
    if (creatorRow.length > 0) {
      await emailService.notifyCreatorStatusChange({
        creatorEmail: creatorRow[0].email,
        creatorName: creatorRow[0].name,
        complaintId: id,
        newStatus: status,
        department: deptRow.length ? deptRow[0].department : "N/A",
        resolution: status === "Resolved" ? resolution : "",
      });
    }

    res.json({ message: "Complaint updated successfully" });
  } catch (error) {
    console.error("Update complaint error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params

    // Only admin can delete complaints
    if (!["admin", "customer_relations_officer"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" })
    }

    
    const [complaints] = await pool.query("SELECT * FROM complaints WHERE id = ?", [id])
    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found" })
    }

    await pool.query("DELETE FROM complaints WHERE id = ?", [id])

    
    await pool.query("DELETE FROM attachments WHERE complaint_id = ?", [id])

    res.json({ message: "Complaint deleted successfully" })
  } catch (error) {
    console.error("Delete complaint error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
