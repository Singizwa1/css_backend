const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.notifyHandlerAssignment = async ({
  handlerEmail,
  handlerName,
  customerName,
  inquiryType,
}) => {
  try {
    await transporter.sendMail({
      from: `"Customer Complaints System" <${process.env.EMAIL_USER}>`,
      to: handlerEmail,
      subject: `New Complaint Assigned (${inquiryType})`,
      html: `
        <div style="font-family: sans-serif;">
          <img src="cid:orgLogo" alt="Organization Logo" width="120" />
          <p>Hello ${handlerName},</p>
          <p>You have been assigned a new complaint.</p>
          <ul>
            <li><strong>Customer:</strong> ${customerName}</li>
            <li><strong>Type:</strong> ${inquiryType}</li>
          </ul>
          <p>Please log in to the system for full details.</p>
        </div>
      `,
      attachments: [
        {
          filename: "logo.png",
          path: path.resolve(__dirname, "../assets/logo.png"),
          cid: "orgLogo",
        },
      ],
    });
  } catch (err) {
    console.error("Email to handler failed:", err.message);
  }
};

exports.notifyCreatorStatusChange = async ({
  creatorEmail,
  creatorName,
  inquiryType,
  newStatus,
  department,
  resolution = "",
}) => {
  try {
    await transporter.sendMail({
      from: `"Customer Complaints System" <${process.env.EMAIL_USER}>`,
      to: creatorEmail,
      subject: `Complaint ${inquiryType} has Updated: ${newStatus}`,
      html: `
        <div style="font-family: sans-serif;">
          <img src="cid:orgLogo" alt="Organization Logo" width="120" />
          <p>Hello ${creatorName},</p>
          <p>The complaint you created has been updated.</p>
          <ul>
            <li><strong>Status:</strong> ${newStatus}</li>
            <li><strong>Handled By:</strong> ${department}</li>
            ${
              resolution
                ? `<li><strong>Resolution:</strong> ${resolution}</li>`
                : ""
            }
          </ul>
          <p>You can view more details in the system.</p>
        </div>
      `,
      attachments: [
        {
          filename: "logo.png",
          path: path.resolve(__dirname, "../assets/logo.png"),
          cid: "orgLogo",
        },
      ],
    });
  } catch (err) {
    console.error("Email to creator failed:", err.message);
  }
};
