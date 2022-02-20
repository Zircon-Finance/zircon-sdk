import JSBI from 'jsbi'
import { factory } from './moonbase_address.json'

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
  [ChainId.MOONROCK]: factory,
  [ChainId.MOONBASE]: factory,
  [ChainId.MOONSHADOW]: factory
}

export const INIT_CODE_HASH = '0x5bd289bcfaf5c097cd2e9b2f78ced9c2cbca7c4b44d2bb0f8ebc355546289b1a'
export const PYLON_CODE_HASH = '0x99e0034afde5d5dfacb0abc060c5f76883e242a7a758e36e151b0191d7794c98'

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)
export const THREE = JSBI.BigInt(3)
export const FIVE = JSBI.BigInt(5)
export const TEN = JSBI.BigInt(10)
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
