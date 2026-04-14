require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Email API endpoint
app.post("/send-email", async (req, res) => {
  const { to, subject, message } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: message
    });

    res.json({ success: true, message: "Email sent!" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// Start server (only when run directly)
if (require.main === module) {
  const PORT = process.env.SERVICE_PORT || 5001;
  app.listen(PORT, () => console.log(`Email service running on port ${PORT}`));
}

module.exports = app;
