import JSBI from 'jsbi'
import { factory, pylonFactory, ptFactory } from './moonbase_address.json'

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
export const PT_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0x5c4242beB94dE30b922f57241f1D02f36e906915',
  [ChainId.MOONROCK]: ptFactory,
  [ChainId.MOONBASE]: ptFactory,
  [ChainId.MOONSHADOW]: ptFactory
}

export const INIT_CODE_HASH = '0x56dc0fd33f86964624c6b1dc95716cc706e4a7bd715f3f01589b510655b33ae2'
export const PYLON_CODE_HASH = '0xe9f29a32ecac75732f474db4cc8a5f7200df9570f98d23ea3e38151c6d21d16c'
export const PT_CODE_HASH = '0x76d70bb4b33576e895f22f07f4493a4ec0beec4051cc56a2586110867e2a6a78'

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
export const BASE = JSBI.exponentiate(TEN, EIGHTEEN)
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
