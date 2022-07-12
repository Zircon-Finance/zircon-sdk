import JSBI from 'jsbi'
import { factory, pylonFactory } from './moonbase_address.json'

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

export const FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0x5c4242beB94dE30b922f57241f1D02f36e906915',
  [ChainId.MOONROCK]: factory,
  [ChainId.MOONBASE]: factory,
  [ChainId.MOONSHADOW]: factory
}

export const PYLON_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0x5c4242beB94dE30b922f57241f1D02f36e906915',
  [ChainId.MOONROCK]: pylonFactory,
  [ChainId.MOONBASE]: pylonFactory,
  [ChainId.MOONSHADOW]: pylonFactory
}

export const INIT_CODE_HASH = '0x329b2552c58a4152d353ccd1a4c1ef40a65c42c04acff73af036498dc3060b1c'
export const PYLON_CODE_HASH = '0xddad0eac4d55df88dc4ad7e739a068c994a11e6f36b76e12bb8fdd3b1b395e8c'
export const PT_CODE_HASH = '0x9d48a58c279366838bc32a0283dce84c543f84aaef300a6127a1b849768b97ec'

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)
export const THREE = JSBI.BigInt(3)
export const FIVE = JSBI.BigInt(5)
export const TEN = JSBI.BigInt(10)
export const EIGHTEEN = JSBI.BigInt(18)
export const BASE = JSBI.exponentiate(TEN, EIGHTEEN)
export const _100 = JSBI.BigInt(100)
export const _997 = JSBI.BigInt(997)
export const _1000 = JSBI.BigInt(1000)

export enum SolidityType {
  uint8 = 'uint8',
  uint256 = 'uint256'
}

export const SOLIDITY_TYPE_MAXIMA = {
  [SolidityType.uint8]: JSBI.BigInt('0xff'),
  [SolidityType.uint256]: JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
}
