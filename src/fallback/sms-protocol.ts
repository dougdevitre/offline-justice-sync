/**
 * @module SMSProtocol
 * @description Structured data protocol for encoding/decoding
 * justice-related information within SMS character limits.
 * Supports deadline alerts, hearing reminders, and status updates.
 */

/**
 * Encoded SMS message structure
 */
export interface EncodedSMS {
  /** Message type prefix */
  prefix: string;
  /** Encoded content */
  body: string;
  /** Total character count */
  length: number;
}

/**
 * SMSProtocol encodes structured data into SMS-friendly formats
 * and decodes incoming SMS responses.
 *
 * @example
 * ```typescript
 * const protocol = new SMSProtocol();
 * const encoded = protocol.encodeDeadline('Motion to Dismiss', new Date('2026-04-01'));
 * console.log(encoded.body); // "DL:Motion to Dismiss|2026-04-01"
 * ```
 */
export class SMSProtocol {
  /** Message type prefixes */
  private static readonly PREFIXES = {
    deadline: 'DL',
    hearing: 'HR',
    status: 'ST',
    ack: 'AK',
  };

  /**
   * Encode a deadline alert.
   * @param title - Deadline title
   * @param dueDate - Due date
   * @returns Encoded SMS
   */
  encodeDeadline(title: string, dueDate: Date): EncodedSMS {
    const dateStr = dueDate.toISOString().split('T')[0];
    const body = `${SMSProtocol.PREFIXES.deadline}:${title}|${dateStr}`;
    return { prefix: SMSProtocol.PREFIXES.deadline, body, length: body.length };
  }

  /**
   * Encode a hearing reminder.
   * @param caseNumber - Case number
   * @param location - Hearing location
   * @param dateTime - Hearing date and time
   * @returns Encoded SMS
   */
  encodeHearing(caseNumber: string, location: string, dateTime: Date): EncodedSMS {
    const dateStr = dateTime.toISOString().substring(0, 16);
    const body = `${SMSProtocol.PREFIXES.hearing}:${caseNumber}|${location}|${dateStr}`;
    return { prefix: SMSProtocol.PREFIXES.hearing, body, length: body.length };
  }

  /**
   * Decode an incoming SMS response.
   * @param message - Raw SMS text
   * @returns Decoded type and data
   */
  decode(message: string): { type: string; data: Record<string, string> } {
    const parts = message.split(':');
    const prefix = parts[0];
    const payload = parts.slice(1).join(':');
    const fields = payload.split('|');

    switch (prefix) {
      case SMSProtocol.PREFIXES.deadline:
        return { type: 'deadline', data: { title: fields[0], dueDate: fields[1] } };
      case SMSProtocol.PREFIXES.hearing:
        return { type: 'hearing', data: { caseNumber: fields[0], location: fields[1], dateTime: fields[2] } };
      case SMSProtocol.PREFIXES.ack:
        return { type: 'ack', data: { messageId: fields[0] } };
      default:
        return { type: 'unknown', data: { raw: message } };
    }
  }
}
