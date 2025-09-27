'use client';

import { useState, useEffect, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { addresses, CoverageManagerABI } from '@/lib/contracts';
import { formatUnits, parseAbiItem } from 'viem';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'event' | 'hedge' | 'system' | 'error';
  source: string;
  message: string;
  data?: any;
}

export function DebugConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isBotConnected, setIsBotConnected] = useState(false);
  const [filters, setFilters] = useState({
    showEvents: true,
    showHedge: true,
    showSystem: true,
    showErrors: true,
  });
  const [searchFilter, setSearchFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const publicClient = usePublicClient();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // WebSocket connection for bot logs
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const websocket = new WebSocket('ws://localhost:8787');
        
        websocket.onopen = () => {
          setIsBotConnected(true);
          addLog('system', 'WebSocket', 'Connected to hedge bot');
        };
        
        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'event') {
              addLog('event', data.name, `Event: ${data.name}`, data);
            } else if (data.type === 'hedge') {
              addLog('hedge', 'Hedge Bot', `Hedge ${data.action}: ${data.policyId.slice(0, 10)}...`, data);
            } else {
              addLog('system', 'Hedge Bot', data.message || JSON.stringify(data), data);
            }
          } catch (error) {
            addLog('error', 'Hedge Bot', `Parse error: ${event.data}`);
          }
        };
        
        websocket.onclose = () => {
          setIsBotConnected(false);
          addLog('system', 'WebSocket', 'Disconnected from hedge bot');
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
        
        websocket.onerror = (error) => {
          setIsBotConnected(false);
          addLog('system', 'WebSocket', `Error: ${error}`);
        };
        
        setWs(websocket);
      } catch (error) {
        setIsBotConnected(false);
        addLog('system', 'WebSocket', `Failed to connect: ${error}`);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Watch for on-chain events
  useEffect(() => {
    if (!publicClient || !addresses.coverageManager) return;

    // Parse event ABI items for better type safety
    const policyCreatedEvent = parseAbiItem('event PolicyCreated(bytes32 indexed policyId, address indexed policyHolder, address indexed tokenAddress, uint256 coverageAmount, uint256 premium, uint256 expiryTime)');
    const claimSettledEvent = parseAbiItem('event ClaimSettled(bytes32 indexed policyId, address indexed claimant, uint256 claimAmount, uint256 drawdownBps)');
    const claimStatusChangedEvent = parseAbiItem('event ClaimStatusChanged(bytes32 indexed policyId, uint8 status)');
    const payoutSettledEvent = parseAbiItem('event PayoutSettled(bytes32 indexed policyId, address indexed recipient, uint256 amount, address indexed token)');

    const unwatchPolicyCreated = publicClient.watchContractEvent({
      address: addresses.coverageManager as `0x${string}`,
      abi: CoverageManagerABI,
      eventName: 'PolicyCreated',
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          addLog('event', 'PolicyCreated', 
            `Policy ${log.args.policyId?.slice(0, 10) || 'unknown'}... created by ${log.args.policyHolder?.slice(0, 10) || 'unknown'}...`,
            log.args
          );
        });
      },
    });

    const unwatchClaimSettled = publicClient.watchContractEvent({
      address: addresses.coverageManager as `0x${string}`,
      abi: CoverageManagerABI,
      eventName: 'ClaimSettled',
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          addLog('event', 'ClaimSettled',
            `Claim settled for policy ${log.args.policyId?.slice(0, 10) || 'unknown'}... - Amount: ${log.args.claimAmount ? formatUnits(log.args.claimAmount, 18) : '0'}`,
            log.args
          );
        });
      },
    });

    const unwatchClaimStatusChanged = publicClient.watchContractEvent({
      address: addresses.coverageManager as `0x${string}`,
      abi: CoverageManagerABI,
      eventName: 'ClaimStatusChanged',
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          const statusNames = ['Active', 'Expired', 'Claimed', 'Cancelled'];
          const statusName = statusNames[Number(log.args.status)] || 'Unknown';
          addLog('event', 'ClaimStatusChanged',
            `Policy ${log.args.policyId?.slice(0, 10) || 'unknown'}... status changed to ${statusName}`,
            log.args
          );
        });
      },
    });

    const unwatchPayoutSettled = publicClient.watchContractEvent({
      address: addresses.coverageManager as `0x${string}`,
      abi: CoverageManagerABI,
      eventName: 'PayoutSettled',
      onLogs: (logs) => {
        logs.forEach((log: any) => {
          addLog('event', 'PayoutSettled',
            `Payout settled for policy ${log.args.policyId?.slice(0, 10) || 'unknown'}... - Amount: ${log.args.amount ? formatUnits(log.args.amount, 18) : '0'} to ${log.args.recipient?.slice(0, 10) || 'unknown'}...`,
            log.args
          );
        });
      },
    });

    return () => {
      unwatchPolicyCreated();
      unwatchClaimSettled();
      unwatchClaimStatusChanged();
      unwatchPayoutSettled();
    };
  }, [publicClient]);

  const addLog = (type: LogEntry['type'], source: string, message: string, data?: any) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      source,
      message,
      data,
    };
    
    setLogs(prev => [...prev, newLog].slice(-1000)); // Keep last 1000 logs
  };

  const copyLogs = () => {
    const logText = filteredLogs
      .map(log => `[${log.timestamp.toISOString()}] ${log.type.toUpperCase()} [${log.source}] ${log.message}`)
      .join('\n');
    
    navigator.clipboard.writeText(logText);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = logs.filter(log => {
    // Type filters
    if (log.type === 'event' && !filters.showEvents) return false;
    if (log.type === 'hedge' && !filters.showHedge) return false;
    if (log.type === 'system' && !filters.showSystem) return false;
    if (log.type === 'error' && !filters.showErrors) return false;
    
    // Search filter
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      return (
        log.message.toLowerCase().includes(searchLower) ||
        log.source.toLowerCase().includes(searchLower) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });

  return (
    <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 h-96 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Debug Console</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isBotConnected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
            <span className="text-xs">{isBotConnected ? 'Bot Online' : 'Bot Offline'}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={copyLogs}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Copy Logs
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 space-y-2">
        {/* Search Filter */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="flex-1 px-2 py-1 bg-gray-800 text-green-400 border border-gray-600 rounded text-xs"
          />
          <button
            onClick={clearLogs}
            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
          >
            Clear
          </button>
        </div>
        
        {/* Type Filters */}
        <div className="flex space-x-4 text-xs">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.showEvents}
              onChange={(e) => setFilters(prev => ({ ...prev, showEvents: e.target.checked }))}
              className="mr-1"
            />
            <span className="text-blue-400">Events</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.showHedge}
              onChange={(e) => setFilters(prev => ({ ...prev, showHedge: e.target.checked }))}
              className="mr-1"
            />
            <span className="text-purple-400">Hedge</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.showSystem}
              onChange={(e) => setFilters(prev => ({ ...prev, showSystem: e.target.checked }))}
              className="mr-1"
            />
            <span className="text-yellow-400">System</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.showErrors}
              onChange={(e) => setFilters(prev => ({ ...prev, showErrors: e.target.checked }))}
              className="mr-1"
            />
            <span className="text-red-400">Errors</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="mr-1"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2">
              <span className="text-gray-500 text-xs whitespace-nowrap">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className={`text-xs font-semibold ${
                log.type === 'event' ? 'text-blue-400' :
                log.type === 'hedge' ? 'text-purple-400' :
                log.type === 'error' ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                [{log.type.toUpperCase()}]
              </span>
              <span className="text-gray-400 text-xs">
                [{log.source}]
              </span>
              <span className={`${
                log.type === 'event' ? 'text-blue-300' :
                log.type === 'hedge' ? 'text-purple-300' :
                log.type === 'error' ? 'text-red-300' :
                'text-green-300'
              }`}>
                {log.message}
              </span>
              {log.data && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500">Data</summary>
                  <pre className="mt-1 text-gray-400 overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
