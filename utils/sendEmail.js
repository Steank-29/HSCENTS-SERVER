const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Create transporter with correct Gmail settings
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false, // false for port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false // Helps with some connection issues
    }
  });

  // Verify connection (optional but helpful for debugging)
  await transporter.verify();

  // Email options
  const mailOptions = {
    from: `"Hamdi Scents" <${process.env.EMAIL_USER}>`, // Changed from NAVI to Hamdi Scents
    to: options.email,
    subject: options.subject,
    html: options.html
  };

  // Send email
  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email sent to ${options.email}`, info.messageId);
  return info;
};

module.exports = sendEmail;