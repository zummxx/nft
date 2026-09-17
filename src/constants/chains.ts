import { ChainConfig } from '../types';

export const DEFAULT_OPENSEA_FEE_RECIPIENT = '0x0000a26b00c1F0DF003000390027140000fAa719';

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: 5042,
    name: 'Arc Network',
    nameZh: 'Arc 链',
    nativeSymbol: 'USDC',
    rpcUrl: 'https://rpc.mainnet.arc.io',
    fallbackRpcs: [],
    explorerUrl: 'https://arc-scan.org',
    seaDropAddress: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5',
    iconColor: '#2775CA',
    isTestnet: false,
  },
  {
    id: 4663,
    name: 'Robinhood Chain',
    nameZh: 'Robinhood Chain',
    nativeSymbol: 'ETH',
    rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
    fallbackRpcs: [],
    explorerUrl: 'https://robinhoodchain.blockscout.com',
    seaDropAddress: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5',
    iconColor: '#00C805',
    isTestnet: false,
  },
  {
    id: 57073,
    name: 'Ink Mainnet',
    nameZh: 'Ink (Kraken L2)',
    nativeSymbol: 'ETH',
    rpcUrl: 'https://rpc-gel.inkonchain.com',
    fallbackRpcs: [
      'https://rpc-qnd.inkonchain.com',
      'https://ink.drpc.org',
      'https://57073.rpc.thirdweb.com'
    ],
    explorerUrl: 'https://explorer.inkonchain.com',
    seaDropAddress: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5',
    iconColor: '#7C3AED',
    isTestnet: false,
  },
  {
    id: 1,
    name: 'Ethereum Mainnet',
    nameZh: '以太坊主网',
    nativeSymbol: 'ETH',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    fallbackRpcs: [
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
      'https://rpc.payload.de'
    ],
    explorerUrl: 'https://etherscan.io',
    seaDropAddress: '0x00005EA00Ac477B1030CE78506496e8C2dE24bf5',
    iconColor: '#627EEA',
    isTestnet: false,
  },
];

export const SEADROP_ABI = [
  'function getPublicDrop(address nftContract) external view returns (tuple(uint80 mintPrice, uint48 startTime, uint48 endTime, uint16 maxTotalMintableByWallet, uint16 feeBps, bool restrictFeeRecipients))',
  'function getFeeRecipient(address nftContract) external view returns (address)',
  'function getAllowedFeeRecipients(address nftContract) external view returns (address[])',
  'function mintPublic(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity) external payable',
  'function getMintStats(address nftContract, address minter) external view returns (uint256 minterNumMinted, uint256 currentTotalMinted, uint256 maxTotalMintableByWallet)',
  // SeaDrop & ERC721SeaDrop Errors
  'error NotActive(uint256 currentTimestamp, uint256 startTimestamp, uint256 endTimestamp)',
  'error MintNotActive()',
  'error MintQuantityCannotBeZero()',
  'error ExceedsMaxTotalMintableByWallet(uint256 total, uint256 allowed)',
  'error MaxTotalMintableByWalletCannotBeZero()',
  'error IncorrectPayment(uint256 got, uint256 want)',
  'error Unauthorized()',
  'error FeeRecipientCannotBeZeroAddress()',
  'error FeeRecipientNotPresent()',
  'error FeeRecipientNotAllowed()',
  'error CreatorPaymentAddressCannotBeZeroAddress()',
  'error InvalidPayer()',
  'error PayerNotPresent()',
  'error InvalidSignature()',
  'error SignerCannotBeZeroAddress()',
  'error InvalidSigner()',
  'error InvalidProof()',
  'error AllowListNotActive()',
  'error TokenGatedNotActive()',
  'error CannotSetFeeBpsAboveMaximum()',
  'error SignerNotPresent()',
  'error MintQuantityExceedsMaxSupply(uint256 total, uint256 maxSupply)',
  'error MaxSupplyCannotBeZero()',
  'error CannotMintMoreTokensThanMaxSupply()',
  'error SeaDropMintCannotBeZero()',
  'error OnlyAllowedSeaDrop()',
  'error SeaDropMintExceedsMaxSupply()'
];

export const ERC721_MINIMAL_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)'
];

// Presets for quick demo & testing
export const DEMO_CONTRACTS = [
  {
    chainId: 4663,
    name: 'HoodBoy NFT (Robinhood Chain)',
    address: '0x2612147f166f793027370190c77d55439e8eeb39',
    description: 'Robinhood Chain SeaDrop 公共铸造合约'
  }
];
