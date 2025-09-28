#!/usr/bin/env tsx

import { execa } from 'execa';
import chalk from 'chalk';
import { writeJson, readJson, setEnvLine, fileExists, readFile } from './utils/fs';
import { getTransactionUrl } from './utils/explorer';

// Types
interface DemoConfig {
  mode: 'fast' | 'pyth';
  verbose: boolean;
  coverageManager?: string;
  premiumToken: string;
  pythContract: string;
  priceId: string;
  policyId?: number;
}

// Constants
const SEPOLIA_CHAIN_ID = 11155111;
const REQUIRED_ROOT_VARS = ['PRIVATE_KEY', 'SEPOLIA_RPC_URL', 'PREMIUM_TOKEN', 'PYTH_CONTRACT', 'PRICE_ID'];
const REQUIRED_UI_VARS = ['NEXT_PUBLIC_CHAIN_ID', 'NEXT_PUBLIC_RPC_URL', 'NEXT_PUBLIC_PYTH'];

// CLI argument parser
function parseArgs() {
  const args = process.argv.slice(2);
  const config: { mode: 'fast' | 'pyth'; verbose: boolean } = {
    mode: 'fast',
    verbose: false
  };
  
  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1] as 'fast' | 'pyth';
      if (mode === 'fast' || mode === 'pyth') {
        config.mode = mode;
      }
    } else if (arg === '--verbose') {
      config.verbose = true;
    }
  }
  
  return config;
}

// Logging helper
function logStep(step: string, message: string) {
  console.log(chalk.blue.bold(`\n🔧 ${step}`));
  console.log(chalk.gray(`   ${message}`));
}

function logSuccess(message: string) {
  console.log(chalk.green(`✅ ${message}`));
}

function logError(message: string) {
  console.log(chalk.red(`❌ ${message}`));
}

function logInfo(message: string) {
  console.log(chalk.cyan(`ℹ️  ${message}`));
}

function logCommand(cmd: string, args: string[] = []) {
  const fullCmd = args.length > 0 ? `${cmd} ${args.join(' ')}` : cmd;
  console.log(chalk.gray(`   Running: ${fullCmd}`));
}

// Enhanced execa wrapper
async function run(cmd: string, args: string[] = [], opts: any = {}) {
  logCommand(cmd, args);
  return await execa(cmd, args, { 
    stdio: 'inherit', 
    ...opts 
  });
}

// Main orchestrator class
class DemoOrchestrator {
  private config: DemoConfig;
  private commands: string[] = [];

  constructor() {
    const cliArgs = parseArgs();
    this.config = {
      mode: process.env.DEMO_MODE as 'fast' | 'pyth' || cliArgs.mode,
      verbose: process.env.VERBOSE === 'true' || cliArgs.verbose,
      premiumToken: process.env.PREMIUM_TOKEN || '',
      pythContract: process.env.PYTH_CONTRACT || '',
      priceId: process.env.PRICE_ID || '',
    };
  }

  async run(): Promise<void> {
    // Print banner
    console.log(chalk.blue.bold('\n🚀 Rug Pull Insurance Demo Orchestrator\n'));
    console.log(chalk.gray('=' .repeat(50)));
    
    // Print configuration
    console.log(chalk.cyan('\n📋 Configuration:'));
    console.log(chalk.gray(`   Mode: ${this.config.mode}`));
    console.log(chalk.gray(`   Verbose: ${this.config.verbose}`));
    console.log(chalk.gray(`   Premium Token: ${this.config.premiumToken}`));
    console.log(chalk.gray(`   Pyth Contract: ${this.config.pythContract}`));
    console.log(chalk.gray(`   Price ID: ${this.config.priceId}`));
    console.log(chalk.gray(`   Private Key: ${process.env.PRIVATE_KEY ? '***' + process.env.PRIVATE_KEY.slice(-4) : 'NOT SET'}`));
    console.log(chalk.gray(`   RPC URL: ${process.env.SEPOLIA_RPC_URL || 'NOT SET'}`));
    
    await this.validateEnvironment();
    await this.startUIAndBot();
    await this.deployCoverageManager();
    await this.seedReserves();
    await this.approveTokens();
    await this.buyPolicy();
    await this.makeClaimable();
    await this.settleClaim();
    await this.printSummary();
    
    console.log(chalk.green.bold('\n✅ Demo completed successfully!\n'));
  }

  private async validateEnvironment(): Promise<void> {
    logStep('Environment Validation', 'Checking required environment variables...');
    
    const missingRootVars: string[] = [];
    const missingUIVars: string[] = [];
    
    // Check root .env
    for (const varName of REQUIRED_ROOT_VARS) {
      if (!process.env[varName]) {
        missingRootVars.push(varName);
      }
    }
    
    // Check UI .env
    const uiEnvPath = './ui/.env';
    if (!fileExists(uiEnvPath)) {
      logError('UI .env file not found. Please create ui/.env with required variables.');
      process.exit(1);
    }
    
    const uiEnv = readFile(uiEnvPath);
    for (const varName of REQUIRED_UI_VARS) {
      if (!uiEnv.includes(varName)) {
        missingUIVars.push(varName);
      }
    }
    
    if (missingRootVars.length > 0 || missingUIVars.length > 0) {
      logError('Missing required environment variables:');
      if (missingRootVars.length > 0) {
        console.log(chalk.red(`   Root .env: ${missingRootVars.join(', ')}`));
      }
      if (missingUIVars.length > 0) {
        console.log(chalk.red(`   UI .env: ${missingUIVars.join(', ')}`));
      }
      process.exit(1);
    }
    
    logSuccess('Environment validation passed');
  }

  private async startUIAndBot(): Promise<void> {
    logStep('Starting UI and Bot', 'Launching development servers...');
    
    const command = 'npm run dev:all';
    this.commands.push(command);
    
    try {
      // Start UI and bot in background
      await run('npm', ['run', 'dev:all'], { detached: true });
      logSuccess('UI and Bot started');
    } catch (error) {
      logInfo('Could not start bot, continuing with UI only');
    }
  }

  private async deployCoverageManager(): Promise<void> {
    logStep('Deploying CoverageManager', 'Deploying smart contract to Sepolia...');
    
    const command = 'npm run deploy:sepolia';
    this.commands.push(command);
    
    try {
      const { stdout } = await run('npm', ['run', 'deploy:sepolia']);
      
      // Extract address from stdout
      const addressMatch = stdout.match(/CoverageManager:\s+(0x[a-fA-F0-9]{40})/);
      if (!addressMatch) {
        throw new Error('Could not find CoverageManager address in deploy output');
      }
      
      this.config.coverageManager = addressMatch[1];
      
      // Update addresses.json
      const addressesPath = './packages/shared/addresses.json';
      const addresses = readJson(addressesPath);
      addresses.networks.sepolia.coverageManager = this.config.coverageManager;
      writeJson(addressesPath, addresses);
      logInfo(`Updated ${addressesPath}`);
      
      // Update UI .env
      setEnvLine('./ui/.env', 'NEXT_PUBLIC_COVERAGE_MANAGER', this.config.coverageManager);
      logInfo(`Updated ./ui/.env`);
      
      logSuccess(`CoverageManager deployed: ${this.config.coverageManager}`);
    } catch (error) {
      logError(`CoverageManager deployment failed: ${error}`);
      throw error;
    }
  }

  private async seedReserves(): Promise<void> {
    logStep('Seeding Reserves', 'Adding test tokens to the pool...');
    
    const command = 'npm run seed';
    this.commands.push(command);
    
    try {
      await run('npm', ['run', 'seed']);
      logSuccess('Reserves seeded');
    } catch (error) {
      logInfo('Seeding failed, continuing...');
    }
  }

  private async approveTokens(): Promise<void> {
    logStep('Approving Tokens', 'Approving premium tokens for CoverageManager...');
    
    const command = 'npm run approve -- 10';
    this.commands.push(command);
    
    try {
      await run('npm', ['run', 'approve', '--', '10']);
      logSuccess('Tokens approved');
    } catch (error) {
      logInfo('Approval failed, continuing...');
    }
  }

  private async buyPolicy(): Promise<void> {
    logStep('Buying Policy', 'Purchasing insurance policy...');
    
    const command = `npm run buy -- 0x0000000000000000000000000000000000000000 10 9000 7200 ${this.config.priceId}`;
    this.commands.push(command);
    
    try {
      const { stdout } = await run('npm', ['run', 'buy', '--', '0x0000000000000000000000000000000000000000', '10', '9000', '7200', this.config.priceId]);
      
      // Extract policy ID from output (assume 1 for now)
      this.config.policyId = 1;
      logSuccess(`Policy bought: ${this.config.policyId}`);
    } catch (error) {
      logError(`Policy purchase failed: ${error}`);
      throw error;
    }
  }

  private async makeClaimable(): Promise<void> {
    if (this.config.mode === 'fast') {
      logStep('Making Claimable (Fast Mode)', 'Using 0% trigger to make policy claimable...');
      
      const command = `npm run check -- ${this.config.policyId} 0`;
      this.commands.push(command);
      
      try {
        await run('npm', ['run', 'check', '--', this.config.policyId!.toString(), '0']);
        logSuccess('Policy made claimable (fast mode)');
      } catch (error) {
        logError(`Check failed: ${error}`);
        throw error;
      }
    } else {
      logStep('Making Claimable (Pyth Mode)', 'Using real Pyth price data...');
      
      try {
        await run('npm', ['run', 'pyth:fetch']);
        await run('npm', ['run', 'pyth:pushcheck', '--', this.config.policyId!.toString()]);
        logSuccess('Policy made claimable (Pyth mode)');
      } catch (error) {
        logInfo('Pyth mode failed, falling back to fast mode');
        this.config.mode = 'fast';
        await this.makeClaimable();
      }
    }
  }

  private async settleClaim(): Promise<void> {
    logStep('Settling Claim', 'Processing the insurance claim...');
    
    const command = `npm run settle -- ${this.config.policyId}`;
    this.commands.push(command);
    
    try {
      await run('npm', ['run', 'settle', '--', this.config.policyId!.toString()]);
      logSuccess('Claim settled');
    } catch (error) {
      logError(`Settlement failed: ${error}`);
      throw error;
    }
  }

  private async printSummary(): Promise<void> {
    console.log(chalk.green.bold('\n📊 Demo Summary'));
    console.log(chalk.gray('=' .repeat(50)));
    console.log(chalk.cyan(`CoverageManager: ${this.config.coverageManager}`));
    console.log(chalk.cyan(`Premium Token: ${this.config.premiumToken}`));
    console.log(chalk.cyan(`Pyth Contract: ${this.config.pythContract}`));
    console.log(chalk.cyan(`Price ID: ${this.config.priceId}`));
    console.log(chalk.cyan(`Policy ID: ${this.config.policyId}`));
    console.log(chalk.cyan(`Mode: ${this.config.mode}`));
    console.log(chalk.green('\n🌐 Open UI: http://localhost:3000'));
    console.log(chalk.yellow('If UI was already running, we didn\'t restart it.'));
    console.log(chalk.yellow('\n📝 Commands executed:'));
    this.commands.forEach((cmd, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${cmd}`));
    });
  }
}

// Main execution with fail-fast wrapper
(async () => {
  try {
    const orchestrator = new DemoOrchestrator();
    await orchestrator.run();
  } catch (error) {
    console.error(chalk.red('❌ Orchestrator error:'), error);
    process.exit(1);
  }
})();
