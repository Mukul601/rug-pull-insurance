import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { getChain, config as contractConfig } from './contracts';

// Get the selected chain from contracts configuration
const selectedChain = getChain(contractConfig.chainId);

export const config = getDefaultConfig({
  appName: 'Rug Pull Insurance',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'your-project-id',
  chains: [selectedChain],
  ssr: true, // If your dApp uses server side rendering (SSR)
});

export { selectedChain };
