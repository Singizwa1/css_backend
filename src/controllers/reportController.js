// src/controllers/reportController.js
const pool = require('../config/db');

// Get complaints by category
exports.getComplaintsByCategory = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT inquiry_type as category, COUNT(*) as count 
      FROM complaints 
      GROUP BY inquiry_type
    `);

    res.json(results);
  } catch (error) {
    console.error('Get complaints by category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get resolution time by department
exports.getResolutionTimeByDepartment = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        u.department, 
        AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.updated_at)) as averageHours
      FROM 
        complaints c
      JOIN 
        users u ON c.assigned_to = u.id
      WHERE 
        c.status = 'Resolved'
      GROUP BY 
        u.department
    `);

    res.json(results);
  } catch (error) {
    console.error('Get resolution time by department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get complaint status distribution
exports.getComplaintStatusDistribution = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM complaints 
      GROUP BY status
    `);

    res.json(results);
  } catch (error) {
    console.error('Get complaint status distribution error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get monthly complaint trend
exports.getMonthlyComplaintTrend = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        DATE_FORMAT(date, '%Y-%m') as month,
        COUNT(*) as count
      FROM 
        complaints
      WHERE 
        date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY 
        DATE_FORMAT(date, '%Y-%m')
      ORDER BY 
        month
    `);

    res.json(results);
  } catch (error) {
    console.error('Get monthly complaint trend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get department performance
exports.getDepartmentPerformance = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        u.department,
        COUNT(c.id) as total_complaints,
        SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_complaints,
        ROUND((SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) / COUNT(c.id)) * 100, 2) as resolution_rate,
        AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.updated_at)) as avg_resolution_time
      FROM 
        complaints c
      JOIN 
        users u ON c.assigned_to = u.id
      GROUP BY 
        u.department
    `);

    res.json(results);
  } catch (error) {
    console.error('Get department performance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getWeeklyComplaints = async (req, res) => {
  try {
    const { range = "week", startDate, endDate } = req.query;

    let query = `
      SELECT 
        c.id,
        DATE(c.date) AS date,
        c.customer_name AS customerName,
        c.inquiry_type AS inquiryType,
        c.status,
        u.department AS assignedDepartment,
        c.resolution
      FROM complaints c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE 1=1
    `;

    if (range === "custom" && startDate && endDate) {
      query += ` AND DATE(c.date) BETWEEN ? AND ?`;
    } else if (range === "week") {
      query += ` AND DATE(c.date) >= CURDATE() - INTERVAL 7 DAY`;
    } else if (range === "last_week") {
      query += `
        AND DATE(c.date) >= CURDATE() - INTERVAL 14 DAY
        AND DATE(c.date) < CURDATE() - INTERVAL 7 DAY
      `;
    } else if (range === "month") {
      query += ` AND YEAR(c.date) = YEAR(CURDATE()) AND MONTH(c.date) = MONTH(CURDATE())`;
    } else if (range === "quarter") {
      query += ` AND c.date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`;
    } else if (range === "year") {
      query += ` AND YEAR(c.date) = YEAR(CURDATE())`;
    }

    query += ` ORDER BY c.date DESC`;

    const params = range === "custom" && startDate && endDate ? [startDate, endDate] : [];

    const [results] = await pool.query(query, params);

    res.json(results);
  } catch (error) {
    console.error("Failed to fetch complaints:", error);
    res.status(500).json({ message: "Server error fetching complaints" });
  }
};
