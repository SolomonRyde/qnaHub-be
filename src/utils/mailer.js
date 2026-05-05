const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  name: "rydefoundation.in" // 👈 VERY IMPORTANT
});

// Verify connection at startup
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Connection Error:', error.message);
    console.error('Full error:', error);
  } else {
    console.log('✅ SMTP Server ready');
   
  }
});

exports.sendOTP = async (email, otp, name) => {
  try {
    const mailOptions = {
  from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
  to: email,
  subject: 'Your OTP for Email Verification',
  html: `<p>Hello <strong>${name}</strong>,</p>
         <p>Your verification OTP is <strong>${otp}</strong>.</p>
         <p>It will expire in 10 minutes.</p>`,
  messageId: `<${Date.now()}@rydefoundation.in>`,
  date: new Date(),
  headers: {
    'X-Mailer': 'NodeMailer',
    'MIME-Version': '1.0',
    'Content-Type': 'text/html; charset=UTF-8'
  }
};

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return info;
  } catch (error) {
    console.error('Email sending error:', error.message);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

exports.sendResetLink = async (email, resetLink, name) => {
  try {
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password reset request for your account',
      html: `
  <div style="font-family: Arial, sans-serif; background-color: #f6f8fb; padding: 20px;">
    
    <div style="max-width: 500px; margin: auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e0e0e0;">
      
      <h2 style="margin-top: 0; color: #333;">Password Reset Request</h2>
      
      <p style="color: #555;">Hello <strong>${name}</strong>,</p>

      <p style="color: #555;">
        We received a request to reset your account password.
      </p>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetLink}" target="_blank"
           style="
             background-color: #4CAF50;
             color: #ffffff;
             padding: 12px 20px;
             text-decoration: none;
             border-radius: 5px;
             font-weight: bold;
             display: inline-block;
           ">
           Reset Password
        </a>
      </div>

      <p style="color: #777; font-size: 14px;">
        This link will expire in 30 minutes for security reasons.
      </p>

      <p style="color: #777; font-size: 14px;">
        If you did not request this, you can safely ignore this email.
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

      <p style="color: #aaa; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} Ryde Foundation
      </p>

    </div>
  </div>
`,
      messageId: `<${Date.now()}@rydefoundation.in>`,
      date: new Date(),
      headers: {
        'X-Mailer': 'NodeMailer',
        'MIME-Version': '1.0',
        'Content-Type': 'text/html; charset=UTF-8'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Reset email sent:', info.response);
    return info;

  } catch (error) {
    console.error('Reset email error:', error.message);
    throw new Error(`Failed to send reset link: ${error.message}`);
  }
};