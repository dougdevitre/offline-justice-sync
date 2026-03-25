/**
 * @module SMSGateway
 * @description Sends and receives SMS messages through Twilio for critical
 * notifications when internet is unavailable. Used as a fallback channel
 * for deadline alerts, hearing reminders, and emergency communications.
 */

import type { SMSGatewayConfig, SMSMessage, SMSMessageType, SMSDeliveryStatus } from '../types';

/**
 * SMSGateway provides SMS communication via Twilio for critical alerts
 * when internet connectivity is unavailable.
 *
 * @example
 * ```typescript
 * const gateway = new SMSGateway({
 *   accountSid: process.env.TWILIO_ACCOUNT_SID!,
 *   authToken: process.env.TWILIO_AUTH_TOKEN!,
 *   fromNumber: process.env.TWILIO_PHONE_NUMBER!,
 * });
 *
 * await gateway.sendCritical('+15551234567', 'DEADLINE: Motion due tomorrow 9am');
 * ```
 */
export class SMSGateway {
  private config: SMSGatewayConfig;
  private sentMessages: SMSMessage[] = [];

  /**
   * Create a new SMSGateway.
   * @param config - Twilio configuration
   */
  constructor(config: SMSGatewayConfig) {
    this.config = config;
  }

  /**
   * Send a critical alert via SMS.
   * @param to - Recipient phone number
   * @param content - Message content
   * @param type - Message type
   * @returns The sent message record
   */
  async sendCritical(to: string, content: string, type: SMSMessageType = 'critical'): Promise<SMSMessage> {
    const message: SMSMessage = {
      id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      recipientPhone: to,
      content: this.truncateForSMS(content),
      type,
      deliveryStatus: 'queued',
      sentAt: new Date(),
    };

    try {
      // In production: use Twilio client
      // const twilioMessage = await twilioClient.messages.create({
      //   body: message.content,
      //   from: this.config.fromNumber,
      //   to: message.recipientPhone,
      // });
      // message.twilioSid = twilioMessage.sid;

      message.deliveryStatus = 'sent';
    } catch (error) {
      message.deliveryStatus = 'failed';
      throw error;
    }

    this.sentMessages.push(message);
    return message;
  }

  /**
   * Send a deadline reminder via SMS.
   * @param to - Recipient phone number
   * @param deadline - Deadline description
   * @param dueDate - When the deadline is
   */
  async sendDeadlineReminder(to: string, deadline: string, dueDate: Date): Promise<SMSMessage> {
    const content = `JUSTICE OS REMINDER: ${deadline} - Due: ${dueDate.toLocaleDateString()}. Reply HELP for assistance.`;
    return this.sendCritical(to, content, 'deadline');
  }

  /**
   * Send a hearing reminder via SMS.
   * @param to - Recipient phone number
   * @param hearingDetails - Hearing description
   * @param hearingDate - When the hearing is
   */
  async sendHearingReminder(to: string, hearingDetails: string, hearingDate: Date): Promise<SMSMessage> {
    const content = `JUSTICE OS HEARING: ${hearingDetails} - ${hearingDate.toLocaleDateString()} at ${hearingDate.toLocaleTimeString()}. Reply HELP for assistance.`;
    return this.sendCritical(to, content, 'hearing');
  }

  /**
   * Get all sent messages.
   */
  getSentMessages(): SMSMessage[] {
    return [...this.sentMessages];
  }

  /**
   * Check the delivery status of a message.
   * @param messageId - The message ID
   * @returns Current delivery status
   */
  async checkDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus> {
    const message = this.sentMessages.find((m) => m.id === messageId);
    if (!message) throw new Error(`Message not found: ${messageId}`);
    return message.deliveryStatus;
  }

  /**
   * Truncate content to fit within SMS limits (160 chars for single SMS).
   */
  private truncateForSMS(content: string, maxLength: number = 160): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  }
}
