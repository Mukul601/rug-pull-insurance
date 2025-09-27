import { ethers } from 'ethers';

export interface ContractABI {
  [key: string]: any[];
}

export const INSURANCE_CONTRACT_ABI: ContractABI = {
  // This would be the actual ABI from your compiled contract
  // For now, this is a placeholder structure
  "PolicyCreated": [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "policyId",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "policyHolder",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "tokenAddress",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "coverageAmount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "premium",
          "type": "uint256"
        }
      ],
      "name": "PolicyCreated",
      "type": "event"
    }
  ],
  "createPolicy": [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenAddress",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "coverageAmount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "duration",
          "type": "uint256"
        }
      ],
      "name": "createPolicy",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    }
  ]
};

export class ContractManager {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
  }

  async getContract(address: string, abi: ContractABI): Promise<ethers.Contract> {
    const contractKey = `${address}-${JSON.stringify(abi)}`;
    
    if (!this.contracts.has(contractKey)) {
      const contract = new ethers.Contract(address, abi, this.signer || this.provider);
      this.contracts.set(contractKey, contract);
    }

    return this.contracts.get(contractKey)!;
  }

  async getInsuranceContract(address: string): Promise<ethers.Contract> {
    return this.getContract(address, INSURANCE_CONTRACT_ABI);
  }

  async getTokenContract(address: string): Promise<ethers.Contract> {
    const tokenABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function totalSupply() view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function name() view returns (string)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Approval(address indexed owner, address indexed spender, uint256 value)"
    ];
    
    return this.getContract(address, tokenABI);
  }

  async getLiquidityPoolContract(address: string): Promise<ethers.Contract> {
    const poolABI = [
      "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address owner) view returns (uint256)"
    ];
    
    return this.getContract(address, poolABI);
  }
}

