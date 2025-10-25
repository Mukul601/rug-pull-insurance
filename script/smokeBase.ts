#!/usr/bin/env tsx

import { 
  createClients, 
  getNetworkConfig, 
  logInfo, 
  logSuccess, 
  logError,
  getExplorerUrl
} from './utils';
import chalk from 'chalk';

interface SmokeTestResult {
  coverageManager: string;
  premiumToken: string;
  poolReserves: string;
  protocolFees: string;
  managerCodeExists: boolean;
  chainId: number;
}

async function smokeTestBase(): Promise<void> {
  console.log(chalk.blue.bold('\n🔍 Base Sepolia Smoke Test\n'));
  console.log(chalk.gray('=' .repeat(50)));

  const chainId = 84532; // Base Sepolia
  
  try {
    // Load network configuration
    const networkConfig = getNetworkConfig(chainId as any);
    
    if (!networkConfig.coverageManager) {
      throw new Error('CoverageManager address not found in network configuration');
    }
    
    if (!networkConfig.premiumToken) {
      throw new Error('PremiumToken address not found in network configuration');
    }

    logInfo('Loading contract state...', {
      coverageManager: networkConfig.coverageManager,
      premiumToken: networkConfig.premiumToken,
      chainId
    });

    // Create clients
    const { publicClient } = createClients(chainId as any);

    // CoverageManager ABI for reading state
    const coverageManagerABI = [
      {
        name: 'poolReserves',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
      },
      {
        name: 'protocolFees',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
      }
    ] as const;

    // Read contract state
    const [poolReserves, protocolFees, managerCode] = await Promise.all([
      publicClient.readContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: coverageManagerABI,
        functionName: 'poolReserves'
      }),
      publicClient.readContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: coverageManagerABI,
        functionName: 'protocolFees'
      }),
      publicClient.getCode({
        address: networkConfig.coverageManager as `0x${string}`
      })
    ]);

    const result: SmokeTestResult = {
      coverageManager: networkConfig.coverageManager,
      premiumToken: networkConfig.premiumToken,
      poolReserves: poolReserves.toString(),
      protocolFees: protocolFees.toString(),
      managerCodeExists: managerCode !== '0x',
      chainId
    };

    // Print results
    console.log(chalk.green.bold('\n📊 Smoke Test Results'));
    console.log(chalk.gray('=' .repeat(50)));
    
    console.log(chalk.cyan(`Chain ID: ${result.chainId} (Base Sepolia)`));
    console.log(chalk.cyan(`CoverageManager: ${result.coverageManager}`));
    console.log(chalk.cyan(`PremiumToken: ${result.premiumToken}`));
    console.log(chalk.cyan(`Pool Reserves: ${result.poolReserves}`));
    console.log(chalk.cyan(`Protocol Fees: ${result.protocolFees}`));
    
    // Check manager code
    if (result.managerCodeExists) {
      console.log(chalk.green('✅ Manager code exists on chain'));
    } else {
      console.log(chalk.red('❌ Manager code not found on chain'));
    }

    // Print explorer links
    console.log(chalk.blue('\n🔗 BaseScan Links:'));
    console.log(chalk.blue(`   CoverageManager: ${getExplorerUrl(chainId)}/address/${result.coverageManager}`));
    console.log(chalk.blue(`   PremiumToken: ${getExplorerUrl(chainId)}/address/${result.premiumToken}`));

    // Summary
    if (result.managerCodeExists) {
      console.log(chalk.green.bold('\n✅ Smoke test passed! Base Sepolia contracts are healthy.'));
    } else {
      console.log(chalk.red.bold('\n❌ Smoke test failed! Manager contract not found.'));
      process.exit(1);
    }

  } catch (error) {
    logError('Smoke test failed', error);
    console.log(chalk.red.bold('\n❌ Smoke test failed!'));
    process.exit(1);
  }
}

// Run the smoke test
smokeTestBase().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
