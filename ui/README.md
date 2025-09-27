# Rug Pull Insurance UI

A Next.js application for the Rug Pull Insurance protocol, built with TypeScript, TailwindCSS, wagmi, and RainbowKit.

## 🚀 Features

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **TailwindCSS** for styling
- **wagmi** for Ethereum interactions
- **RainbowKit** for wallet connection
- **Responsive Design** for all devices

## 🛠️ Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Web3**: wagmi + RainbowKit
- **State Management**: TanStack Query
- **Chains**: Ethereum, Polygon, Arbitrum, Optimism, Sepolia

## 📦 Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp env.example .env.local
```

3. Update `.env.local` with your values:
```bash
NEXT_PUBLIC_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id
```

## 🚀 Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Build

Build the application for production:

```bash
npm run build
```

## 🚀 Production

Start the production server:

```bash
npm run start
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_RPC_URL` | RPC URL for blockchain network | Yes |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID (1=mainnet, 11155111=sepolia, etc.) | Yes |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect Project ID | Yes |
| `NEXT_PUBLIC_COVERAGE_MANAGER_ADDRESS` | CoverageManager contract address | No |
| `NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS` | Payment token address | No |

### Supported Chains

- **Ethereum Mainnet** (Chain ID: 1)
- **Sepolia Testnet** (Chain ID: 11155111)
- **Polygon** (Chain ID: 137)
- **Arbitrum** (Chain ID: 42161)
- **Optimism** (Chain ID: 10)

## 📁 Project Structure

```
ui/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── navbar.tsx
│   │   └── providers.tsx
│   └── lib/
│       └── wagmi.ts
├── public/
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## 🎨 Styling

The application uses TailwindCSS for styling with a clean, modern design:

- **Colors**: Blue and gray color scheme
- **Typography**: Inter font family
- **Layout**: Responsive grid system
- **Components**: Custom components with Tailwind classes

## 🔌 Wallet Connection

The application uses RainbowKit for wallet connection, supporting:

- MetaMask
- WalletConnect
- Coinbase Wallet
- Rainbow Wallet
- And many more

## 📱 Responsive Design

The UI is fully responsive and works on:

- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

The app can be deployed to any platform that supports Next.js:

- Netlify
- AWS Amplify
- Railway
- Render

## 🔧 Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.