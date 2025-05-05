const pool = require("../config/db")
const formidable = require('formidable');
const { put } = require('@vercel/blob');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
require('dotenv').config(); 

// Get all complaints
// Get all complaints
exports.getAllComplaints = async (req, res) => {
  try {
    let query = ""
    let params = []

    // Filter based on user role
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

    // Now enrich each complaint with assignedToUser structure
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

      // Clean up extra fields if desired
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

    // Get attachments
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
      return res.status(400).json({ message: 'Invalid form data' });
    }

    try {
      if (req.user.role !== 'customer_relations_officer') {
        return res.status(403).json({ message: 'Access denied' });
      }

      const {
        customerName,
        customerPhone,
        channel,
        inquiryType,
        details,
        attemptedResolution,
        resolutionDetails,
        forwardTo,
      } = fields;

      if (!customerName || !customerPhone || !inquiryType || !details) {
        return res.status(400).json({ message: 'Required fields are missing' });
      }

      let assignedTo;

      if (forwardTo) {
        const [departments] = await pool.query(
          'SELECT id FROM users WHERE department = ? AND role = "complaints_handler" LIMIT 1',
          [forwardTo]
        );

        if (departments.length === 0) {
          return res.status(400).json({ message: 'Selected department not found' });
        }

        assignedTo = departments[0].id;
      } else {
        let department;

        switch (inquiryType) {
          case 'Technical Issue':
          case 'Forgotten Password':
            department = 'IT Department';
            break;
          case 'Payment Delay':
          case 'Financial Transaction':
            department = 'Funds Administration';
            break;
          case 'Repurchase Issue':
          case 'Financial Approval':
            department = 'Finance & Accounting';
            break;
          default:
            department = 'IT Department';
        }

        const [handlers] = await pool.query(
          'SELECT id FROM users WHERE department = ? AND role = "complaints_handler" LIMIT 1',
          [department]
        );

        if (handlers.length === 0) {
          return res.status(400).json({ message: 'No handler found for this inquiry type' });
        }

        assignedTo = handlers[0].id;
      }

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
          customerName,
          customerPhone,
          channel,
          inquiryType,
          details,
          'Pending',
          assignedTo,
          req.user.id,
          attemptedResolution ? 1 : 0,
          resolutionDetails || null,
          forwardTo ? req.user.id : null,
        ]
      );

      const complaintId = result.insertId;

      // Handle file uploads via Vercel Blob
      const uploadedFiles = Array.isArray(files.files)
        ? files.files
        : files.files
        ? [files.files]
        : [];

      for (const file of uploadedFiles) {
        const fileStream = fs.createReadStream(file.filepath);
        const blobName = `${uuidv4()}-${file.originalFilename}`;
        const { url } = await put(blobName, fileStream, {
          access: 'public',
          token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
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
            blobName,
            file.originalFilename,
            file.mimetype,
            file.size,
            url,
          ]
        );
      }

      // Notify the assigned handler
      await pool.query(
        `INSERT INTO notifications (
          user_id, 
          title, 
          message, 
          type, 
          \`read\`
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          assignedTo,
          'New Complaint Assigned',
          `You have been assigned a new complaint from ${customerName} regarding ${inquiryType}.`,
          'assignment',
          0,
        ]
      );

      // Get department for response
      const [handlerData] = await pool.query('SELECT department FROM users WHERE id = ?', [assignedTo]);
      const assignedDepartment = handlerData[0].department;

      res.status(201).json({
        id: complaintId,
        message: `Complaint registered successfully and forwarded to ${assignedDepartment}!`,
      });
    } catch (error) {
      console.error('Create complaint error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};


// Update complaint - 
exports.updateComplaint = async (req, res) => {
  try {
    const { id } = req.params
    const { status, resolution } = req.body

    // Validate input
    if (!status) {
      return res.status(400).json({ message: "Status is required" })
    }

    if (status === "Resolved" && !resolution) {
      return res.status(400).json({ message: "Resolution details are required when status is Resolved" })
    }


    const [complaints] = await pool.query("SELECT * FROM complaints WHERE id = ?", [id])

    if (complaints.length === 0) {
      return res.status(404).json({ message: "Complaint not found" })
    }

    const complaint = complaints[0]

    // Check if user has access to update this complaint
    if (
      req.user.role === "complaints_handler" &&
      complaint.assigned_to !== req.user.id &&
      req.user.role !== "admin" &&
      req.user.role !== "customer_relations_officer"
    ) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Update complaint
    await pool.query("UPDATE complaints SET status = ?, resolution = ?, updated_at = NOW() WHERE id = ?", [
      status,
      resolution || null,
      id,
    ])

    // Get user department for notification
    const [userDetails] = await pool.query("SELECT department FROM users WHERE id = ?", [req.user.id])

    const userDepartment = userDetails.length > 0 ? userDetails[0].department : "Department"

    // Create notification for the customer relations officer
    if (status === "Resolved") {
      await pool.query(
        `INSERT INTO notifications (
          user_id, 
          title, 
          message, 
          type, 
          \`read\`
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          complaint.created_by,
          "Complaint Resolved",
          `Complaint #${id} has been resolved by ${userDepartment}.`,
          "resolution",
          0,
        ],
      )
    } else if (status === "In Progress" && complaint.status === "Pending") {
      await pool.query(
        `INSERT INTO notifications (
          user_id, 
          title, 
          message, 
          type, 
          read
        ) VALUES (?, ?, ?, ?, ?)`,
        [complaint.created_by, "Complaint Updated", `Complaint #${id} status updated to In Progress.`, "update", 0],
      )
    }

    res.json({ message: "Complaint updated successfully" })
  } catch (error) {
    console.error("Update complaint error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

// Delete complaint (admin only)
exports.deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params

    // Only admin can delete complaints
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    // Check if complaint exists
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
