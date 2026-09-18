// src/utils/mailer.js
const nodemailer = require("nodemailer");

// 1. Setup Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  name: "rydecs.com", // Important for SPF/DKIM alignment
});

// Verify connection at startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:", error.message);
  } else {
    console.log("✅ SMTP Server ready - Ryde Consulting/QnaHub");
  }
});

// --- SHARED CONSTANTS ---
const BRAND_GREEN = "#16a249";
const TEXT_DARK = "#1f1e1d";
const TEXT_BODY = "#3d3d3a";
const TEXT_MUTED = "#8a8a85";
const TEXT_LIGHT = "#9c9b96";
const BORDER_COLOR = "#ecebe5";
const BG_OUTER = "#f4f3ee";

// Logo URL (Use env var in production, fallback to public folder for local testing)
const LOGO_URL = process.env.LOGO_URL;

// Escape any user-supplied string before it goes into HTML. Without this,
// a contact-form submitter can inject raw markup/links into mail your
// domain sends — which is a common cause of a sender getting flagged.
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Reusable Sign-Off Block (Updated with spacing + support message)
const getSignOffHTML = () => `
  <p style="margin: 0 0 8px; font-size: 12px; color: ${TEXT_BODY}; font-family: Arial, Helvetica, sans-serif;">
    Best regards,
  </p>
  <p style="margin: 0 0 12px; font-size: 12px; color: ${TEXT_BODY}; font-weight: bold; font-family: Arial, Helvetica, sans-serif;">
    The Ryde Foundation & Ryde Consulting Team
  </p>
  <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${TEXT_MUTED}; font-family: Arial, Helvetica, sans-serif;">
    If you have any issues, please contact us at 
    <a href="mailto:admin@rydecs.com" style="color: ${BRAND_GREEN}; text-decoration: none; font-weight: 500;">admin@rydecs.com</a>.
  </p>
`;

// Helper: Side-by-Side Header (Logo + QnaHub Wordmark)
const getHeaderHTML = () => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 32px; width: 100%;">
    <tr>
      <td valign="middle" style="padding-right: 12px; width: 70px;">
        <img src="${LOGO_URL}" width="60" height="60" alt="Ryde Foundation logo" 
             style="display: block; border-radius: 8px; object-fit: cover;">
      </td>
      <td valign="middle">
        <span style="font-size: 28px; font-weight: 700; letter-spacing: 0.5px; color: ${TEXT_DARK}; font-family: Arial, Helvetica, sans-serif;">
          Qna<span style="color: ${BRAND_GREEN}">Hub</span>
        </span>
        <div style="font-size: 12px; color: ${TEXT_LIGHT}; margin-top: 4px; font-family: Arial, Helvetica, sans-serif;">
          by Ryde Consulting
        </div>
      </td>
    </tr>
  </table>
`;

// --- EMAIL TEMPLATES ---

// 1. OTP VERIFICATION EMAIL
const otpTemplate = (name, otp) => {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - QnaHub</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_OUTER}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">
    Hello ${safeName}, your QnaHub verification OTP is ${safeOtp}. Expires in 10 minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_OUTER}; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px;" cellpadding="0" cellspacing="0">
          
          <!-- White Card -->
          <tr>
            <td style="background: #ffffff; border-radius: 12px; padding: 40px 40px 32px;">
              
              ${getHeaderHTML()}

              <h1 style="margin: 0 0 20px; font-size: 22px; line-height: 1.4; font-weight: 600; color: ${TEXT_DARK}; font-family: Arial, Helvetica, sans-serif;">
                Verify your email address
              </h1>

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: ${TEXT_BODY}; font-family: Arial, Helvetica, sans-serif;">
                Hi ${safeName},
              </p>

              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: ${TEXT_BODY}; font-family: Arial, Helvetica, sans-serif;">
                Thank you for joining QnaHub. To complete your account verification, please use the OTP below:
              </p>

              <!-- OTP Display Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #EEF8F0; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td align="center" style="padding: 24px 20px;">
                    <p style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${TEXT_MUTED}; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">
                      Your One-Time Password
                    </p>
                    <h2 style="margin: 0; font-size: 32px; font-weight: 700; color: ${BRAND_GREEN}; letter-spacing: 6px; font-family: 'Courier New', Courier, monospace;">
                      ${safeOtp}
                    </h2>
                    <p style="margin: 12px 0 0; font-size: 13px; color: ${TEXT_MUTED}; font-family: Arial, Helvetica, sans-serif;">
                      This code expires in <strong>10 minutes</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-left: 3px solid ${BRAND_GREEN}; padding-left: 15px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; padding-bottom: 24px; line-height: 1.6; color: ${TEXT_MUTED}; font-family: Arial, Helvetica, sans-serif;">
                      <strong>Security:</strong> Never share this code with anyone. If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

              ${getSignOffHTML()}

            </td>
          </tr>

          <!-- Outer Footer Info -->
          <tr>
            <td align="center" style="padding: 24px 12px 0; font-size: 11px; line-height: 1.7; color: ${TEXT_LIGHT}; font-family: Arial, Helvetica, sans-serif;">
              <p style="margin: 0 0 4px;">QnaHub • Chennai, Tamil Nadu, India</p>
              <p style="margin: 0;">© 2026 QnaHub by Ryde Consulting. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// 2. PASSWORD RESET EMAIL
const resetTemplate = (name, resetLink) => {
  const safeName = escapeHtml(name);
  // resetLink is a system-generated URL, not free-text user input, but it's
  // still escaped for the href attribute context to be safe.
  const safeResetLink = escapeHtml(resetLink);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - QnaHub</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_OUTER}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">
    Hello ${safeName}, click the link below to reset your QnaHub password. Link expires in 30 minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_OUTER}; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px;" cellpadding="0" cellspacing="0">
          
          <tr>
            <td style="background: #ffffff; border-radius: 12px; padding: 40px 40px 32px;">
              
              ${getHeaderHTML()}

              <h1 style="margin: 0 0 20px; font-size: 22px; line-height: 1.4; font-weight: 600; color: ${TEXT_DARK}; font-family: Arial, Helvetica, sans-serif;">
                Reset your password
              </h1>

              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: ${TEXT_BODY}; font-family: Arial, Helvetica, sans-serif;">
                Hi ${safeName},
              </p>

              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: ${TEXT_BODY}; font-family: Arial, Helvetica, sans-serif;">
                We received a request to reset the password for your QnaHub account.
              </p>

              <!-- Bulletproof Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_GREEN};">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeResetLink}" style="height:46px;v-text-anchor:middle;width:180px;" arcsize="10%" stroke="f" fillcolor="${BRAND_GREEN}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Reset Password</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="${safeResetLink}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; font-family: Arial, Helvetica, sans-serif;">
                      Reset Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.7; color: ${TEXT_MUTED}; font-family: Arial, Helvetica, sans-serif;">
                This link will expire in <strong>30 minutes</strong> for your security.<br>
                If you did not request this, you can safely ignore this email.
              </p>

              <hr style="border: none; border-top: 1px solid ${BORDER_COLOR}; margin: 24px 0;">

              <p style="margin: 0; font-size: 13px; padding-bottom: 24px; line-height: 1.7; color: ${TEXT_MUTED}; font-family: Arial, Helvetica, sans-serif;">
                Or paste this link into your browser:<br>
                <a href="${safeResetLink}" style="color: ${BRAND_GREEN}; text-decoration: none; word-break: break-all;">${safeResetLink}</a>
              </p>

              ${getSignOffHTML()}

            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 24px 12px 0; font-size: 11px; line-height: 1.7; color: ${TEXT_LIGHT}; font-family: Arial, Helvetica, sans-serif;">
              <p style="margin: 0;">© 2026 QnaHub by Ryde Consulting. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// 3. CONTACT FORM MESSAGE (ADMIN NOTIFICATION)
const contactTemplate = ({ name, email, company, subject, message }) => {
  // All user-supplied fields are escaped before going into HTML — this is
  // the fix for the biggest risk in this file: a public contact form lets
  // anyone inject markup/links into mail your domain sends.
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeCompany = escapeHtml(company);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  // encodeURIComponent for the mailto query string so spaces/special
  // characters in the subject don't break or truncate the link.
  const mailtoHref = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Re: ${subject}`)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Message - QnaHub</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_OUTER}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
  
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">
    New message from ${safeName} (${safeEmail}) regarding "${safeSubject}".
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_OUTER}; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px;" cellpadding="0" cellspacing="0">
          
          <tr>
            <td style="background: #ffffff; border-radius: 12px; padding: 40px 40px 32px;">
              
              ${getHeaderHTML()}

              <h1 style="margin: 0 0 20px; font-size: 22px; line-height: 1.4; font-weight: 600; color: ${TEXT_DARK}; font-family: Arial, Helvetica, sans-serif;">
                New Contact Form Message
              </h1>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: ${TEXT_BODY}; font-family: Arial, Helvetica, sans-serif;">
                You have received a new message from your website contact form.
              </p>

              <!-- Info Grid -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border-collapse: separate; border-spacing: 0 8px;">
                <tr>
                  <td width="80" style="font-size: 13px; color: ${TEXT_MUTED}; vertical-align: top; font-family: Arial, Helvetica, sans-serif;">Name</td>
                  <td style="font-size: 15px; color: ${TEXT_DARK}; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${safeName}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: ${TEXT_MUTED}; vertical-align: top; font-family: Arial, Helvetica, sans-serif;">Email</td>
                  <td style="font-size: 15px; color: ${TEXT_DARK}; font-family: Arial, Helvetica, sans-serif;">
                    <a href="mailto:${encodeURIComponent(email)}" style="color: ${BRAND_GREEN}; text-decoration: none;">${safeEmail}</a>
                  </td>
                </tr>
                ${
                  company
                    ? `
                <tr>
                  <td style="font-size: 13px; color: ${TEXT_MUTED}; vertical-align: top; font-family: Arial, Helvetica, sans-serif;">Company</td>
                  <td style="font-size: 15px; color: ${TEXT_DARK}; font-family: Arial, Helvetica, sans-serif;">${safeCompany}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="font-size: 13px; color: ${TEXT_MUTED}; vertical-align: top; font-family: Arial, Helvetica, sans-serif;">Subject</td>
                  <td style="font-size: 15px; color: ${TEXT_DARK}; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${safeSubject}</td>
                </tr>
              </table>

              <!-- Message Box -->
              <div style="background-color: #F9FAFB; border: 1px solid ${BORDER_COLOR}; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 14px; padding-bottom: 24px; line-height: 1.7; color: ${TEXT_BODY}; white-space: pre-wrap; font-family: Arial, Helvetica, sans-serif;">${safeMessage}</p>
              </div>

              <!-- Reply Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_GREEN};">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${mailtoHref}" style="height:46px;v-text-anchor:middle;width:180px;" arcsize="10%" stroke="f" fillcolor="${BRAND_GREEN}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Reply to Customer</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="${mailtoHref}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; font-family: Arial, Helvetica, sans-serif;">
                      Reply to Customer
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${TEXT_MUTED}; text-align: center; font-family: Arial, Helvetica, sans-serif;">
                 Replying directly to this email will send your response to <strong>${safeName}</strong> at ${safeEmail}.
              </p>

            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 24px 12px 0; font-size: 11px; line-height: 1.7; color: ${TEXT_LIGHT}; font-family: Arial, Helvetica, sans-serif;">
              <p style="margin: 0;">© 2026 QnaHub by Ryde Consulting. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

// --- EXPORTED FUNCTIONS ---

exports.sendOTP = async (email, otp, name) => {
  try {
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your OTP for Email Verification | QnaHub`,
      html: otpTemplate(name, otp),
      text: `Hello ${name},\n\nYour verification OTP is ${otp}.\nIt will expire in 10 minutes.\n\nBest regards,\nThe Ryde Consulting Team\n\nIf you have any issues, contact admin@rydecs.com`,
      messageId: `<${Date.now()}@rydefoundation.in>`,
      date: new Date(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP sent to ${email}`);
    return info;
  } catch (error) {
    console.error("❌ OTP sending error:", error.message);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

exports.sendResetLink = async (email, resetLink, name) => {
  try {
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Password Reset Request | QnaHub`,
      html: resetTemplate(name, resetLink),
      text: `Hello ${name},\n\nWe received a request to reset your password.\nClick here to reset: ${resetLink}\n\nThis link expires in 30 minutes.\nIf you didn't request this, ignore this email.\n\nBest regards,\nThe Ryde Consulting Team\n\nIf you have any issues, contact admin@rydecs.com`,
      messageId: `<${Date.now()}@rydefoundation.in>`,
      date: new Date(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Reset link sent to ${email}`);
    return info;
  } catch (error) {
    console.error("❌ Reset email error:", error.message);
    throw new Error(`Failed to send reset link: ${error.message}`);
  }
};

exports.sendContactMessage = async ({
  name,
  email,
  company,
  subject,
  message,
}) => {
  try {
    const contactInbox = process.env.CONTACT_INBOX || "admin@rydefoundation.in";

    const mailOptions = {
      from: `"QnaHub Contact" <${process.env.SMTP_USER}>`,
      to: contactInbox,
      replyTo: `${name} <${email}>`,
      subject: subject || `New message from ${name} via QnaHub`,
      html: contactTemplate({ name, email, company, subject, message }),
      text: `New contact form message\n\nName: ${name}\nEmail: ${email}${company ? `\nCompany: ${company}` : ""}\nSubject: ${subject}\n\nMessage:\n${message}\n\n---\nReply directly to this email to respond to ${name} at ${email}.`,
      messageId: `<${Date.now()}@rydefoundation.in>`,
      date: new Date(),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Contact message forwarded to ${contactInbox}`);
    return info;
  } catch (error) {
    console.error("❌ Contact message error:", error.message);
    throw new Error(`Failed to send contact message: ${error.message}`);
  }
};
