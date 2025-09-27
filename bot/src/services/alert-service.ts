import axios from 'axios';
import { RugPullEvent, AlertConfig } from '@rug-pull-insurance/shared';
import { Logger } from '@rug-pull-insurance/shared';

export class AlertService {
  private config: AlertConfig = {};

  async initialize(): Promise<void> {
    Logger.info('Initializing alert service...');
    
    // Load alert configuration from environment variables
    this.config = {
      webhookUrl: process.env.ALERT_WEBHOOK_URL,
      email: process.env.ALERT_EMAIL,
      telegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID ? {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
      } : undefined,
    };
    
    Logger.info('Alert service initialized');
  }

  async cleanup(): Promise<void> {
    Logger.info('Cleaning up alert service...');
    // Cleanup resources if needed
  }

  async sendAlert(event: RugPullEvent): Promise<void> {
    const alertMessage = this.formatAlertMessage(event);
    
    try {
      // Send webhook alert
      if (this.config.webhookUrl) {
        await this.sendWebhookAlert(alertMessage, event);
      }
      
      // Send Telegram alert
      if (this.config.telegram) {
        await this.sendTelegramAlert(alertMessage, event);
      }
      
      // Send email alert (placeholder - would need email service integration)
      if (this.config.email) {
        await this.sendEmailAlert(alertMessage, event);
      }
      
      Logger.info(`Alert sent for rug pull event: ${event.description}`);
    } catch (error) {
      Logger.error('Failed to send alert:', error);
    }
  }

  private formatAlertMessage(event: RugPullEvent): string {
    const severityEmoji = this.getSeverityEmoji(event.severity);
    const timestamp = new Date(event.timestamp * 1000).toISOString();
    
    return `🚨 ${severityEmoji} RUG PULL DETECTED ${severityEmoji}

📊 **Event Details:**
• Token: \`${event.tokenAddress}\`
• Severity: **${event.severity.toUpperCase()}**
• Description: ${event.description}
• Block: ${event.blockNumber}
• Transaction: \`${event.transactionHash}\`
• Timestamp: ${timestamp}

⚠️ **Action Required:** Please investigate this potential rug pull immediately!`;
  }

  private getSeverityEmoji(severity: RugPullEvent['severity']): string {
    switch (severity) {
      case 'low': return '🟡';
      case 'medium': return '🟠';
      case 'high': return '🔴';
      case 'critical': return '🚨';
      default: return '⚠️';
    }
  }

  private async sendWebhookAlert(message: string, event: RugPullEvent): Promise<void> {
    if (!this.config.webhookUrl) return;
    
    try {
      const payload = {
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View on Etherscan',
                },
                url: `https://etherscan.io/tx/${event.transactionHash}`,
              },
            ],
          },
        ],
      };
      
      await axios.post(this.config.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      
      Logger.debug('Webhook alert sent successfully');
    } catch (error) {
      Logger.error('Failed to send webhook alert:', error);
    }
  }

  private async sendTelegramAlert(message: string, event: RugPullEvent): Promise<void> {
    if (!this.config.telegram) return;
    
    try {
      const { botToken, chatId } = this.config.telegram;
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      
      const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      };
      
      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      
      Logger.debug('Telegram alert sent successfully');
    } catch (error) {
      Logger.error('Failed to send Telegram alert:', error);
    }
  }

  private async sendEmailAlert(message: string, event: RugPullEvent): Promise<void> {
    if (!this.config.email) return;
    
    // This is a placeholder - in a real implementation, you would integrate with an email service
    // like SendGrid, AWS SES, or similar
    Logger.info(`Email alert would be sent to ${this.config.email}: ${message}`);
  }
}

