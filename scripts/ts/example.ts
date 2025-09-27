#!/usr/bin/env ts-node

import { 
  logInfo, 
  logSuccess, 
  logError, 
  handleError,
  getNetworkConfig,
  createClients
} from './utils';
import { seedReserves } from './seedReserves';
import { fetchPythPrices } from './fetchPyth';
import { pushPriceAndCheck } from './pushPriceAndCheck';
import { settleClaim } from './settle';

/**
 * Example script demonstrating CoverageManager operations
 * This script shows how to use all the TypeScript scripts together
 */
async function runExample() {
  try {
    const chainId = 11155111; // Sepolia testnet
    const networkConfig = getNetworkConfig(chainId);
    
    logInfo('🚀 CoverageManager Example Script', {
      network: networkConfig.name,
      chainId,
      coverageManager: networkConfig.coverageManager,
      paymentToken: networkConfig.paymentToken
    });
    
    // Step 1: Seed reserves
    logInfo('📦 Step 1: Seeding reserves...');
    await seedReserves({
      chainId,
      amount: '100000', // 100K tokens
      dryRun: true // Use dry run for example
    });
    
    // Step 2: Fetch Pyth prices
    logInfo('📊 Step 2: Fetching Pyth prices...');
    await fetchPythPrices({
      chainId,
      priceIds: ['ETH_USD', 'BTC_USD'],
      maxAge: 3600,
      useEma: false,
      checkDrawdown: false
    });
    
    // Step 3: Push prices and check conditions
    logInfo('🔄 Step 3: Pushing prices and checking conditions...');
    await pushPriceAndCheck({
      chainId,
      priceIds: ['ETH_USD', 'BTC_USD'],
      updateData: [], // Will use mock data
      checkDrawdown: true,
      checkThreshold: true,
      threshold: '1000000000000000000', // 1.0 in 1e18
      dryRun: true // Use dry run for example
    });
    
    // Step 4: Example claim settlement (would need real claim ID)
    logInfo('⚖️ Step 4: Example claim settlement...');
    const exampleClaimId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    try {
      await settleClaim({
        chainId,
        claimId: exampleClaimId,
        approved: true,
        payoutAmount: '1000',
        reason: 'Example settlement',
        dryRun: true // Use dry run for example
      });
    } catch (error) {
      logError('Claim settlement example failed (expected - no real claim)', error);
    }
    
    logSuccess('✅ Example script completed successfully!', {
      stepsCompleted: 4,
      network: networkConfig.name,
      note: 'All operations were run in dry-run mode for safety'
    });
    
  } catch (error) {
    handleError(error, 'runExample');
  }
}

/**
 * Interactive menu for running individual operations
 */
async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };
  
  try {
    console.log('\n🎯 CoverageManager Interactive Script');
    console.log('=====================================\n');
    
    const chainId = parseInt(await question('Enter chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism): '));
    const networkConfig = getNetworkConfig(chainId as any);
    
    console.log(`\nSelected network: ${networkConfig.name}`);
    console.log(`CoverageManager: ${networkConfig.coverageManager}`);
    console.log(`Payment Token: ${networkConfig.paymentToken}\n`);
    
    while (true) {
      console.log('Available operations:');
      console.log('1. Seed reserves');
      console.log('2. Fetch Pyth prices');
      console.log('3. Push prices and check');
      console.log('4. Settle claim');
      console.log('5. Run full example');
      console.log('0. Exit\n');
      
      const choice = await question('Select operation (0-5): ');
      
      switch (choice) {
        case '1': {
          const amount = await question('Enter amount to seed: ');
          const dryRun = (await question('Dry run? (y/n): ')).toLowerCase() === 'y';
          
          await seedReserves({
            chainId,
            amount,
            dryRun
          });
          break;
        }
        
        case '2': {
          const priceIds = (await question('Enter price IDs (comma-separated) or "all": ')).split(',').map(id => id.trim());
          const checkDrawdown = (await question('Check drawdown? (y/n): ')).toLowerCase() === 'y';
          const tokenAddress = checkDrawdown ? await question('Enter token address: ') : undefined;
          
          await fetchPythPrices({
            chainId,
            priceIds,
            tokenAddress,
            checkDrawdown
          });
          break;
        }
        
        case '3': {
          const priceIds = (await question('Enter price IDs (comma-separated): ')).split(',').map(id => id.trim());
          const checkDrawdown = (await question('Check drawdown? (y/n): ')).toLowerCase() === 'y';
          const checkThreshold = (await question('Check threshold? (y/n): ')).toLowerCase() === 'y';
          const threshold = checkThreshold ? await question('Enter threshold (1e18 units): ') : '1000000000000000000';
          const dryRun = (await question('Dry run? (y/n): ')).toLowerCase() === 'y';
          
          await pushPriceAndCheck({
            chainId,
            priceIds,
            updateData: [],
            checkDrawdown,
            checkThreshold,
            threshold,
            dryRun
          });
          break;
        }
        
        case '4': {
          const claimId = await question('Enter claim ID: ');
          const approved = (await question('Approve claim? (y/n): ')).toLowerCase() === 'y';
          const payoutAmount = approved ? await question('Enter payout amount: ') : undefined;
          const reason = await question('Enter settlement reason: ');
          const dryRun = (await question('Dry run? (y/n): ')).toLowerCase() === 'y';
          
          await settleClaim({
            chainId,
            claimId,
            approved,
            payoutAmount,
            reason,
            dryRun
          });
          break;
        }
        
        case '5': {
          await runExample();
          break;
        }
        
        case '0': {
          console.log('👋 Goodbye!');
          rl.close();
          return;
        }
        
        default: {
          console.log('❌ Invalid choice. Please try again.');
        }
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
  } catch (error) {
    handleError(error, 'runInteractive');
  } finally {
    rl.close();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    await runInteractive();
  } else if (args.includes('--example') || args.includes('-e')) {
    await runExample();
  } else {
    console.log(`
Usage: ts-node example.ts [options]

Options:
  --interactive, -i    Run interactive menu
  --example, -e        Run example script
  --help, -h           Show this help

Examples:
  ts-node example.ts --interactive    # Interactive menu
  ts-node example.ts --example        # Run example script
    `);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(handleError);
}

export { runExample, runInteractive };
