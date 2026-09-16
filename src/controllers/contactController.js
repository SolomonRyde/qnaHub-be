const Joi = require("joi");
const { sendContactMessage } = require("../utils/mailer");
const { catchAsync, throwError } = require("../utils/errorHandler");

const contactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
  subject: Joi.string().trim().max(150).allow("", null),
  message: Joi.string().trim().min(10).max(2000).required(),
  // Honeypot field: real users never fill this in. Any bot that fills every
  // field will trip this and get silently dropped below.
  company: Joi.string().allow("", null),
});

exports.sendContact = catchAsync(async (req, res) => {
  const { error, value } = contactSchema.validate(req.body);
  if (error) {
    return throwError(error.details[0].message, 400);
  }

  const { name, email, subject, message, company } = value;

  // Honeypot tripped — pretend success, don't actually send.
  if (company) {
    return res.status(200).json({ success: true });
  }

  await sendContactMessage({ name, email, subject, message });

  res.status(200).json({
    success: true,
    message: "Your message has been sent. We'll get back to you soon.",
  });
});
