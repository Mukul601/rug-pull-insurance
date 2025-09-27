import { NextRequest, NextResponse } from 'next/server';

interface Command {
  id: string;
  title: string;
  description: string;
  command: string;
  category: 'oracle' | 'settle' | 'inspect' | 'general';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId') || '11155111';
    const coverageManager = searchParams.get('coverageManager') || '0x...';
    const policyId = searchParams.get('policyId') || '0x...';
    
    // Get chain name for display
    const chainNames: Record<string, string> = {
      '1': 'mainnet',
      '11155111': 'sepolia',
      '137': 'polygon',
      '42161': 'arbitrum',
      '10': 'optimism',
    };
    
    const chainName = chainNames[chainId] || 'unknown';
    
    const commands: Command[] = [
      // Oracle and Check Commands
      {
        id: 'push-oracle-check',
        title: 'Push Oracle & Check Claims',
        description: 'Push Pyth price updates and check for claimable policies',
        command: `cd ../script && npm run push ${chainId} "${coverageManager}" "${policyId}"`,
        category: 'oracle',
      },
      {
        id: 'push-oracle-only',
        title: 'Push Oracle Only',
        description: 'Push Pyth price updates without checking claims',
        command: `cd ../script && npm run push ${chainId} "${coverageManager}" ""`,
        category: 'oracle',
      },
      {
        id: 'check-claims',
        title: 'Check Claims Only',
        description: 'Check for claimable policies without pushing oracle',
        command: `cd ../script && npm run check ${chainId} "${coverageManager}"`,
        category: 'oracle',
      },
      
      // Settle Commands
      {
        id: 'settle-claim',
        title: 'Settle Claim',
        description: 'Settle a specific claim by policy ID',
        command: `cd ../script && npm run settle ${chainId} "${policyId}"`,
        category: 'settle',
      },
      {
        id: 'settle-all-claims',
        title: 'Settle All Claims',
        description: 'Settle all claimable policies',
        command: `cd ../script && npm run settle-all ${chainId}`,
        category: 'settle',
      },
      
      // Inspect Commands
      {
        id: 'inspect-contract',
        title: 'Inspect Contract',
        description: 'Inspect contract state, reserves, and fees',
        command: `cd ../script && npm run inspect ${chainId}`,
        category: 'inspect',
      },
      {
        id: 'inspect-token',
        title: 'Inspect Token',
        description: 'Inspect specific token reserves and fees',
        command: `cd ../script && npm run inspect ${chainId} -- --token "${coverageManager}"`,
        category: 'inspect',
      },
      {
        id: 'inspect-policy',
        title: 'Inspect Policy',
        description: 'Inspect specific policy details',
        command: `cd ../script && npm run inspect ${chainId} -- --policy "${policyId}"`,
        category: 'inspect',
      },
      
      // General Commands
      {
        id: 'approve-tokens',
        title: 'Approve Tokens',
        description: 'Approve premium tokens for CoverageManager',
        command: `cd ../script && npm run approve ${chainId} "1000"`,
        category: 'general',
      },
      {
        id: 'buy-policy',
        title: 'Buy Policy',
        description: 'Purchase insurance policy',
        command: `cd ../script && npm run buy ${chainId} "${coverageManager}" "100" 10000 2592000 "ETH_USD"`,
        category: 'general',
      },
      {
        id: 'start-bot',
        title: 'Start Hedge Bot',
        description: 'Start the WebSocket hedge bot',
        command: `cd ../bot && npm run bot:ws`,
        category: 'general',
      },
    ];

    // Filter commands based on query parameters
    const category = searchParams.get('category');
    const filteredCommands = category 
      ? commands.filter(cmd => cmd.category === category)
      : commands;

    return NextResponse.json({
      success: true,
      data: {
        commands: filteredCommands,
        metadata: {
          chainId,
          chainName,
          coverageManager,
          policyId,
          totalCommands: filteredCommands.length,
        },
      },
    });
  } catch (error) {
    console.error('Error generating commands:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate commands',
        data: {
          commands: [],
          metadata: {
            chainId: '11155111',
            chainName: 'sepolia',
            coverageManager: '0x...',
            policyId: '0x...',
            totalCommands: 0,
          },
        },
      },
      { status: 500 }
    );
  }
}
