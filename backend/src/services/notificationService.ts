import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { logger } from '../utils/logger.js';
import { notificationConfig } from '../config.js';

/** Escape HTML special characters to prevent XSS in emails */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize services
let emailTransporter: nodemailer.Transporter | null = null;
let smsClient: twilio.Twilio | null = null;

// Initialize email transporter
if (notificationConfig.smtp.user && notificationConfig.smtp.pass) {
  emailTransporter = nodemailer.createTransport({
    host: notificationConfig.smtp.host,
    port: notificationConfig.smtp.port,
    secure: notificationConfig.smtp.secure,
    auth: {
      user: notificationConfig.smtp.user,
      pass: notificationConfig.smtp.pass,
    },
  });
  logger.info('Email service initialized');
}

// Initialize SMS client
if (notificationConfig.twilio.accountSid && notificationConfig.twilio.authToken) {
  smsClient = twilio(notificationConfig.twilio.accountSid, notificationConfig.twilio.authToken);
  logger.info('SMS service initialized');
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
    logger.warn('Email service not configured');
    return false;
  }

  try {
    await emailTransporter.sendMail({
      from: `"II-VMS System" <${notificationConfig.smtp.user}>`,
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

    logger.info({ to, subject }, 'Email sent');
    return true;
  } catch (error) {
    logger.error({ err: error, to }, 'Email sending failed');
    return false;
  }
}

/**
 * Send SMS notification
 */
export async function sendSMSNotification(to: string, message: string): Promise<boolean> {
  if (!smsClient) {
    logger.warn('SMS service not configured');
    return false;
  }

  try {
    await smsClient.messages.create({
      body: message,
      from: notificationConfig.twilio.fromNumber,
      to,
    });

    logger.info({ to }, 'SMS sent');
    return true;
  } catch (error) {
    logger.error({ err: error, to }, 'SMS sending failed');
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
  // Fire-and-forget notification - never block registration
  try {
    const adminEmail = notificationConfig.adminEmail;
    const adminPhone = notificationConfig.adminPhone;

    if (!adminEmail && !adminPhone) {
      logger.warn('Admin contact not configured for notifications');
      return;
    }

    const message = `
    <p><strong>New Visitor Arrival</strong></p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(visitor.name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(visitor.email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(visitor.phone)}</li>
      <li><strong>Purpose:</strong> ${escapeHtml(visitor.purpose)}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
    </ul>
    <p>Please review and take necessary action.</p>
  `;

    // Send email to admin
    if (adminEmail) {
      await sendEmailNotification(adminEmail, '🔔 New Visitor Arrival', message);
    }

    // Send SMS to admin (optional)
    if (adminPhone && notificationConfig.enableSmsAlerts) {
      await sendSMSNotification(
        adminPhone,
        `New visitor: ${visitor.name} arrived for ${visitor.purpose}`
      );
    }

    // Send welcome email to visitor
    const welcomeMessage = `
    <p>Dear ${escapeHtml(visitor.name)},</p>
    <p>Thank you for registering at our facility. Your visit has been recorded.</p>
    <ul>
      <li><strong>Registration Time:</strong> ${new Date().toLocaleString()}</li>
      <li><strong>Purpose:</strong> ${escapeHtml(visitor.purpose)}</li>
    </ul>
    <p>Please present your QR code at the entrance for check-in.</p>
    <p>Have a great visit!</p>
  `;

    await sendEmailNotification(visitor.email, '✅ Registration Confirmed - II-VMS', welcomeMessage);
  } catch (err) {
    // Log but don't throw - registration must succeed even if notification fails
    logger.error({ err, visitor: visitor.email }, "Notification failed (non-blocking)");
  }
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
  const adminEmail = notificationConfig.adminEmail;
  const adminPhone = notificationConfig.adminPhone;

  if (!adminEmail && !adminPhone) {
    return;
  }

  const message = `
    <p><strong>⚠️ Failed Face Verification Alert</strong></p>
    <ul>
      <li><strong>Visitor:</strong> ${escapeHtml(visitor.name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(visitor.email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(visitor.phone)}</li>
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
  if (adminPhone && notificationConfig.enableSmsAlerts) {
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
  const adminEmail = notificationConfig.adminEmail;

  if (!adminEmail) {
    return;
  }

  const message = `
    <p><strong>📊 Repeated Visit Pattern Detected</strong></p>
    <ul>
      <li><strong>Visitor:</strong> ${escapeHtml(visitor.name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(visitor.email)}</li>
      <li><strong>Total Visits:</strong> ${visitor.visitCount}</li>
      <li><strong>Visit Frequency:</strong> ${visitor.frequency.toFixed(2)} visits/day</li>
      <li><strong>Last Visit:</strong> ${escapeHtml(visitor.lastVisit)}</li>
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
  const adminEmail = notificationConfig.adminEmail;
  const adminPhone = notificationConfig.adminPhone;

  if (!adminEmail && !adminPhone) {
    return;
  }

  const message = `
    <p><strong>🚨 Suspicious Activity Alert</strong></p>
    <ul>
      <li><strong>Visitor:</strong> ${escapeHtml(visitor.name)}</li>
      <li><strong>Email:</strong> ${escapeHtml(visitor.email)}</li>
      <li><strong>Reason:</strong> ${escapeHtml(visitor.reason)}</li>
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
  if (adminPhone && notificationConfig.enableSmsAlerts) {
    await sendSMSNotification(
      adminPhone,
      `CRITICAL: Suspicious activity detected for ${visitor.name}. Check system immediately.`
    );
  }
}
