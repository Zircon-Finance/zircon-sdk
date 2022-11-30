import JSBI from 'jsbi'

import {BSC_ADDRESSES, ChainId, MOONBASE_ADDRESSES, MOONRIVER_ADDRESSES, SolidityType} from '../constants'
import { validateSolidityTypeInstance } from '../utils'

/**
 * A currency is any fungible financial instrument on Ethereum, including Ether and all ERC20 tokens.
 *
 * The only instance of the base class `Currency` is Ether.
 */
export class Currency {
  public readonly decimals: number
  public readonly symbol?: string
  public readonly name?: string

  /**
   * The only instance of the base class `Currency`.
   */
  public static readonly NATIVE_TOKEN: { [key: string]: Currency } = {
    [ChainId.STANDALONE]: new Currency(18, 'DEV', 'DEV Token'),
    [ChainId.MOONRIVER]: new Currency(18, 'MOVR', 'Moonriver Token'),
    [ChainId.MOONBASE]: new Currency(18, 'DEV', 'DEV Token'),
    [ChainId.MOONROCK]: new Currency(18, 'DEV', 'DEV Token'),
    [ChainId.MOONSHADOW]: new Currency(18, 'DEV', 'DEV Token'),
    [ChainId.BSC]: new Currency(18, 'BNB', 'BNB Token')
  }


  /**
   * Constructs an instance of the base class `Currency`. The only instance of the base class `Currency` is `Currency.ETHER`.
   * @param decimals decimals of the currency
   * @param symbol symbol of the currency
   * @param name of the currency
   */
  protected constructor(decimals: number, symbol?: string, name?: string) {
    validateSolidityTypeInstance(JSBI.BigInt(decimals), SolidityType.uint8)

    this.decimals = decimals
    this.symbol = symbol
    this.name = name
  }
}

const NATIVE_TOKEN = Currency.NATIVE_TOKEN
export { NATIVE_TOKEN }
