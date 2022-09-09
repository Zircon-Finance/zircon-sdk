import JSBI from 'jsbi'
import PairABI from '../src/abis/ZirconPair.json'
import PylonABI from '../src/abis/ZirconPylon.json'
import PoolTokenABI from '../src/abis/ZirconPoolToken.json'

export const PAIR_ABI = PairABI
export const PYLON_ABI = PylonABI
export const POOL_TOKEN_ABI = PoolTokenABI
// exports for external consumption
export type BigintIsh = JSBI | bigint | string

export enum ChainId {
  MAINNET = 1,
  STANDALONE = 1281,
  MOONROCK = 1286,
  MOONBASE = 1287,
  MOONSHADOW = 1288
}

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT
}

export enum Rounding {
  ROUND_DOWN,
  ROUND_HALF_UP,
  ROUND_UP
}

export const MOONBASE_ADDRESSES ={
  "WETH": "0xD909178CC99d318e4D46e7E66a972955859670E1",
  "factory": "0xeEec0dEaC43918612319C24774923f04F8A6f284",
  "router": "0x3B6E4013C359451Bd1929B6d39980f7cC03aa86B",
  "multicall": "0xA37062C793fc1e5Aa46A844A7aE798365Dd7Ce83",
  "pylonRouter" : "0x2664E1d6bBB233eC943960bc52f3139832ae47C0",
  "pylonFactory" : "0x19040fC4c40863F0af606e21E6d1CEef80958858",
  "energyFactory" : "0xe2522E34d2eDAbEd507A8b975ae8d7bf4CBe40ff",
  "farmFactory" : "0x931dEA8C13472452c77065B6eB087E87A16a1BFe",
  "ptFactory" : "0x3EbB4d256C123D9bBccabcfB4cBd0c89A569F867"
}

// deploying "Migrator" (tx: 0xcd5c69ba9da0ef02bf6967c98daf601c8406511fdd3d50de53cc0a4bef687b1c)...: deployed at 0x49675A06F3D243583ecDD55C7FAf26F9b4aD9200 with 1319591 gas
// deploying "FeeToSetter" (tx: 0xb79e0291208313be9918fa5c87860e0805dfd04c728c9d46beed27cedc18bd96)...: deployed at 0xbCea98Df85045F2Fcf5310fE4237ca95C9C24622 with 798377 gas
// deploying "ZirconPeripheralLibrary" (tx: 0xd01ee89156e29acfb8d144aaddd7f9e46b66f156e588cdfa34f2844bd3b97948)...: deployed at 0xc4f039344A48BeA06499d1026Fb9d1629E7DE769 with 277288 gas


export const FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0x2E2Ed0Cfd3AD2f1d34481277b3204d807Ca2F8c2',
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.factory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.factory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.factory
}

export const PYLON_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD',
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.pylonFactory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.pylonFactory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.pylonFactory
}
export const PT_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43',
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.ptFactory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.ptFactory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.ptFactory
}

export const INIT_CODE_HASH = '0x0ec3a964af2d4288dcee11cf85135843bcfc1e8e4f8a107d634a0818cc792ee7'
export const PYLON_CODE_HASH = '0x9fc442a4d7a12215c697eb81564442a0cd83ff2b9db622486b898fe36004e492'
export const PT_CODE_HASH = '0x584a9deddda96e2bea8b2f7be35b08d7ddfd6fa4da2a026d973bc5ba1bbee91a'

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)
export const THREE = JSBI.BigInt(3)
export const FOUR = JSBI.BigInt(4)
export const FIVE = JSBI.BigInt(5)
export const TEN = JSBI.BigInt(10)
export const EIGHTEEN = JSBI.BigInt(18)
export const THIRTYSIX = JSBI.BigInt(36)
export const BASE = JSBI.exponentiate(TEN, EIGHTEEN)
export const DOUBLE_BASE = JSBI.exponentiate(TEN, THIRTYSIX)
export const _100 = JSBI.BigInt(100)
export const _997 = JSBI.BigInt(997)
export const _1000 = JSBI.BigInt(1000)
export const _10000 = JSBI.BigInt(10000)

export enum SolidityType {
  uint8 = 'uint8',
  uint256 = 'uint256'
}

export const SOLIDITY_TYPE_MAXIMA = {
  [SolidityType.uint8]: JSBI.BigInt('0xff'),
  [SolidityType.uint256]: JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
}
