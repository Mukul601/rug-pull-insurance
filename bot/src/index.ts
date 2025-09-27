import dotenv from 'dotenv';
import { BotManager } from './bot-manager';
import { Logger } from '@rug-pull-insurance/shared';

// Load environment variables
dotenv.config();

async function main() {
  try {
    Logger.info('Starting Rug Pull Insurance Bot...');
    
    const botManager = new BotManager();
    await botManager.initialize();
    await botManager.start();
    
    Logger.info('Bot started successfully');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      Logger.info('Received SIGINT, shutting down gracefully...');
      await botManager.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      Logger.info('Received SIGTERM, shutting down gracefully...');
      await botManager.stop();
      process.exit(0);
    });
    
  } catch (error) {
    Logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  Logger.error('Unhandled error in main:', error);
  process.exit(1);
});

