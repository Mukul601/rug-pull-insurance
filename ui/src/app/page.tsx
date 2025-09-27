import { Navbar } from '@/components/navbar';
import { PolicyForm } from '@/components/PolicyForm';
import { PolicyTable } from '@/components/PolicyTable';
import { ActionsPanel } from '@/components/ActionsPanel';
import { DebugConsole } from '@/components/DebugConsole';
import { ReservesCard } from '@/components/ReservesCard';
import { NetworkBanner } from '@/components/NetworkBanner';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <NetworkBanner />
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Rug Pull Insurance
            </h1>
            <p className="text-xl text-gray-600">
              Protect your investments with decentralized insurance coverage
            </p>
          </div>

          {/* Responsive Grid Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="bg-white shadow rounded-2xl p-4">
                <PolicyForm />
              </div>
              
              <div className="bg-white shadow rounded-2xl p-4">
                <ActionsPanel />
              </div>
              
              <div className="bg-white shadow rounded-2xl p-4">
                <ReservesCard />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div className="bg-white shadow rounded-2xl p-4">
                <PolicyTable />
              </div>
              
              <div className="bg-white shadow rounded-2xl p-4">
                <DebugConsole />
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-2xl p-4">
              <div className="text-3xl mb-4">🛡️</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Comprehensive Coverage
              </h3>
              <p className="text-gray-600">
                Protect against rug pulls, smart contract bugs, and other DeFi risks
              </p>
            </div>
            
            <div className="bg-white shadow rounded-2xl p-4">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Fast Claims
              </h3>
              <p className="text-gray-600">
                Quick and automated claim processing with transparent payouts
              </p>
            </div>
            
            <div className="bg-white shadow rounded-2xl p-4">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Decentralized
              </h3>
              <p className="text-gray-600">
                Fully decentralized insurance powered by smart contracts
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}