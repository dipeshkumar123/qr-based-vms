import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

// SMS configuration (Twilio)
const smsConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
};

// Initialize services
let emailTransporter: nodemailer.Transporter | null = null;
let smsClient: twilio.Twilio | null = null;

// Initialize email transporter
if (emailConfig.auth.user && emailConfig.auth.pass) {
  emailTransporter = nodemailer.createTransport(emailConfig);
  console.log('Email service initialized');
}

// Initialize SMS client
if (smsConfig.accountSid && smsConfig.authToken) {
  smsClient = twilio(smsConfig.accountSid, smsConfig.authToken);
  console.log('SMS service initialized');
}

export interface NotificationPayload {
  to: string;
  subject?: string;
  message: string;
  type: 'email' | 'sms' | 'both';
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Send email notification
 */
export async function sendEmailNotification(
  to: string,
  subject: string,
  message: string
): Promise<boolean> {
  if (!emailTransporter) {
    console.warn('Email service not configured');
    return false;
  }

  try {
    await emailTransporter.sendMail({
      from: `"II-VMS System" <${emailConfig.auth.user}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">II-VMS</h1>
            <p style="color: white; margin: 5px 0 0 0;">Intelligent Integrated Visitor Management System</p>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
            <div style="color: #4b5563; line-height: 1.6;">
              ${message}
            </div>
          </div>
          <div style="background: #e5e7eb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
            <p>This is an automated notification from II-VMS. Please do not reply to this email.</p>
            <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} II-VMS. All rights reserved.</p>
          </div>
        </div>
      `,
      text: message.replace(/<[^>]*>/g, ''), // Strip HTML for plain text version
    });

    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}

/**
 * Send SMS notification
 */
export async function sendSMSNotification(to: string, message: string): Promise<boolean> {
  if (!smsClient) {
    console.warn('SMS service not configured');
    return false;
  }

  try {
    await smsClient.messages.create({
      body: message,
      from: smsConfig.fromNumber,
      to,
    });

    console.log(`SMS sent to ${to}`);
    return true;
  } catch (error) {
    console.error('SMS sending failed:', error);
    return false;
  }
}

/**
 * Send notification (email, SMS, or both)
 */
export async function sendNotification(payload: NotificationPayload): Promise<{
  email: boolean;
  sms: boolean;
}> {
  const results = {
    email: false,
    sms: false,
  };

  if (payload.type === 'email' || payload.type === 'both') {
    results.email = await sendEmailNotification(
      payload.to,
      payload.subject || 'II-VMS Notification',
      payload.message
    );
  }

  if (payload.type === 'sms' || payload.type === 'both') {
    // For SMS, strip HTML and limit length
    const smsMessage = payload.message.replace(/<[^>]*>/g, '').substring(0, 160);
    results.sms = await sendSMSNotification(payload.to, smsMessage);
  }

  return results;
}

/**
 * Notify on visitor arrival
 */
export async function notifyVisitorArrival(visitor: {
  name: string;
  email: string;
  phone: string;
  purpose: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPhone = process.env.ADMIN_PHONE || '';

  if (!adminEmail && !adminPhone) {
    console.warn('Admin contact not configured for notifications');
    return;
  }

  const message = `
    <p><strong>New Visitor Arrival</strong></p>
    <ul>
      <li><strong>Name:</strong> ${visitor.name}</li>
      <li><strong>Email:</strong> ${visitor.email}</li>
      <li><strong>Phone:</strong> ${visitor.phone}</li>
      <li><strong>Purpose:</strong> ${visitor.purpose}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
    </ul>
    <p>Please review and take necessary action.</p>
  `;

  // Send email to admin
  if (adminEmail) {
    await sendEmailNotification(adminEmail, '🔔 New Visitor Arrival', message);
  }

  // Send SMS to admin (optional)
  if (adminPhone && process.env.ENABLE_SMS_ALERTS === 'true') {
    await sendSMSNotification(
      adminPhone,
      `New visitor: ${visitor.name} arrived for ${visitor.purpose}`
    );
  }

  // Send welcome email to visitor
  const welcomeMessage = `
    <p>Dear ${visitor.name},</p>
    <p>Thank you for registering at our facility. Your visit has been recorded.</p>
    <ul>
      <li><strong>Registration Time:</strong> ${new Date().toLocaleString()}</li>
      <li><strong>Purpose:</strong> ${visitor.purpose}</li>
    </ul>
    <p>Please present your QR code at the entrance for check-in.</p>
    <p>Have a great visit!</p>
  `;

  await sendEmailNotification(visitor.email, '✅ Registration Confirmed - II-VMS', welcomeMessage);
}

/**
 * Notify on failed face verification
 */
export async function notifyFailedVerification(visitor: {
  name: string;
  email: string;
  phone: string;
  attemptCount?: number;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPhone = process.env.ADMIN_PHONE || '';

  if (!adminEmail && !adminPhone) {
    return;
  }

  const message = `
    <p><strong>⚠️ Failed Face Verification Alert</strong></p>
    <ul>
      <li><strong>Visitor:</strong> ${visitor.name}</li>
      <li><strong>Email:</strong> ${visitor.email}</li>
      <li><strong>Phone:</strong> ${visitor.phone}</li>
      <li><strong>Attempts:</strong> ${visitor.attemptCount || 1}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
    </ul>
    <p><strong>Action Required:</strong> This visitor's face did not match the registered biometric data. Please investigate.</p>
  `;

  // Send email to admin
  if (adminEmail) {
    await sendEmailNotification(adminEmail, '🚨 Failed Face Verification', message);
  }

  // Send SMS for high-priority alerts
  if (adminPhone && process.env.ENABLE_SMS_ALERTS === 'true') {
    await sendSMSNotification(
      adminPhone,
      `ALERT: Failed face verification for ${visitor.name}. Immediate attention required.`
    );
  }
}

/**
 * Notify on repeated visit patterns
 */
export async function notifyRepeatedVisits(visitor: {
  name: string;
  email: string;
  visitCount: number;
  frequency: number;
  lastVisit: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || '';

  if (!adminEmail) {
    return;
  }

  const message = `
    <p><strong>📊 Repeated Visit Pattern Detected</strong></p>
    <ul>
      <li><strong>Visitor:</strong> ${visitor.name}</li>
      <li><strong>Email:</strong> ${visitor.email}</li>
      <li><strong>Total Visits:</strong> ${visitor.visitCount}</li>
      <li><strong>Visit Frequency:</strong> ${visitor.frequency.toFixed(2)} visits/day</li>
      <li><strong>Last Visit:</strong> ${visitor.lastVisit}</li>
    </ul>
    <p>This visitor shows a repeated visit pattern. You may want to consider issuing a regular pass or investigating the activity.</p>
  `;

  await sendEmailNotification(adminEmail, '📊 Repeated Visit Pattern Alert', message);
}

/**
 * Notify on suspicious activity
 */
export async function notifySuspiciousActivity(visitor: {
  name: string;
  email: string;
  reason: string;
  anomalyScore: number;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPhone = process.env.ADMIN_PHONE || '';

  if (!adminEmail && !adminPhone) {
    return;
  }

  const message = `
    <p><strong>🚨 Suspicious Activity Alert</strong></p>
    <ul>
      <li><strong>Visitor:</strong> ${visitor.name}</li>
      <li><strong>Email:</strong> ${visitor.email}</li>
      <li><strong>Reason:</strong> ${visitor.reason}</li>
      <li><strong>Anomaly Score:</strong> ${visitor.anomalyScore.toFixed(2)}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
    </ul>
    <p><strong>Action Required:</strong> This visitor has been flagged by the ML anomaly detection system. Please review immediately.</p>
  `;

  // Send email to admin
  if (adminEmail) {
    await sendEmailNotification(adminEmail, '🚨 Suspicious Activity Detected', message);
  }

  // Send SMS for critical alerts
  if (adminPhone && process.env.ENABLE_SMS_ALERTS === 'true') {
    await sendSMSNotification(
      adminPhone,
      `CRITICAL: Suspicious activity detected for ${visitor.name}. Check system immediately.`
    );
  }
}
