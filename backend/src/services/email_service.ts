import nodemailer from 'nodemailer';
import { env } from '../config/env';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  static async sendOtp(to: string, otpCode: string): Promise<void> {
    // If SMTP isn't configured, fallback to console log only.
    if (!env.SMTP_USER || !env.SMTP_PASS) {
      console.log(`\n=============================================`);
      console.log(`🚀 [DEV MODE] EMAIL OTP FOR ${to}`);
      console.log(`🔑 OTP CODE: ${otpCode}`);
      console.log(`=============================================\n`);
      return;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #0f172a; text-align: center;">Verify Your Account</h2>
        <p style="color: #475569; font-size: 16px;">Hello,</p>
        <p style="color: #475569; font-size: 16px;">Thank you for registering. Please use the following One-Time Password (OTP) to complete your registration. This code is valid for 10 minutes.</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0284c7; background-color: #f0f9ff; padding: 10px 20px; border-radius: 8px;">
            ${otpCode}
          </span>
        </div>
        <p style="color: #475569; font-size: 14px; text-align: center;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"VPN Orchestrator" <${env.SMTP_USER}>`,
        to,
        subject: 'Your Verification Code',
        html: htmlContent
      });
      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw new Error('Failed to send verification email. Please try again later.');
    }
  }
}
