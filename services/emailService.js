const nodemailer = require('nodemailer');

// In production, configure these in your .env file
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
    port: process.env.EMAIL_PORT || 2525,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendResetEmail = async (email, resetLink) => {
    const mailOptions = {
        from: `"eFootball Platform" <${process.env.EMAIL_FROM || 'noreply@efootball.com'}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
                <h2 style="color: #4CAF50;">Password Reset</h2>
                <p>You requested to reset your password for the eFootball Platform.</p>
                <p>Please click the button below to set a new password. This link is valid for 15 minutes.</p>
                <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p style="margin-top: 20px; color: #777; font-size: 0.8em;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

module.exports = { sendResetEmail };