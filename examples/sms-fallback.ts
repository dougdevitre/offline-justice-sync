/**
 * @example SMS Fallback
 * @description Demonstrates the SMS fallback system that sends critical
 * alerts via text message when internet is unavailable.
 *
 * Usage: npx ts-node examples/sms-fallback.ts
 */

import { SMSGateway, ConnectionMonitor } from '../src';

async function main() {
  console.log('=== SMS Fallback Demo ===\n');

  // Initialize SMS gateway (requires Twilio credentials)
  const gateway = new SMSGateway({
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'demo-sid',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'demo-token',
    fromNumber: process.env.TWILIO_PHONE_NUMBER || '+15551234567',
  });

  // Monitor connectivity
  const monitor = new ConnectionMonitor();
  console.log('Monitoring connection...');

  // Simulate offline state — send deadline reminder via SMS
  console.log('Status: OFFLINE');
  console.log('Critical deadline approaching — sending via SMS\n');

  // Send a deadline reminder
  const deadlineMsg = await gateway.sendDeadlineReminder(
    '+15559876543',
    'Motion to Dismiss Response',
    new Date('2026-04-15')
  );

  console.log('Deadline reminder sent:');
  console.log(`  ID: ${deadlineMsg.id}`);
  console.log(`  To: ${deadlineMsg.recipientPhone}`);
  console.log(`  Status: ${deadlineMsg.deliveryStatus}`);
  console.log(`  Content: ${deadlineMsg.content}`);
  console.log();

  // Send a hearing reminder
  const hearingMsg = await gateway.sendHearingReminder(
    '+15559876543',
    'Case #2026-FL-001 Status Conference',
    new Date('2026-04-20T14:00:00')
  );

  console.log('Hearing reminder sent:');
  console.log(`  ID: ${hearingMsg.id}`);
  console.log(`  Status: ${hearingMsg.deliveryStatus}`);
  console.log(`  Content: ${hearingMsg.content}`);
  console.log();

  // List all sent messages
  const allMessages = gateway.getSentMessages();
  console.log(`Total SMS sent: ${allMessages.length}`);
}

main().catch(console.error);
