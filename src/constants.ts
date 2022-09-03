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
  [ChainId.STANDALONE]: '0x2E2Ed0Cfd3AD2f1d34481277b3204d807Ca2F8c2',
  [ChainId.MOONROCK]: factory,
  [ChainId.MOONBASE]: factory,
  [ChainId.MOONSHADOW]: factory
}

export const PYLON_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD',
  [ChainId.MOONROCK]: pylonFactory,
  [ChainId.MOONBASE]: pylonFactory,
  [ChainId.MOONSHADOW]: pylonFactory
}
export const PT_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43',
  [ChainId.MOONROCK]: ptFactory,
  [ChainId.MOONBASE]: ptFactory,
  [ChainId.MOONSHADOW]: ptFactory
}

export const INIT_CODE_HASH = '0x8ac1cfe126870db55b6a7e6ee6a8faf0e06cfec32ee0417cf258c4c96b183a22'
export const PYLON_CODE_HASH = '0x9c43b2576e12d44d8c5615a799d29898386b06dfb2d315f89ee64d44bdc034b2'
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
