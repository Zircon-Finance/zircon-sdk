import { TokenAmount } from 'entities'
import JSBI from 'jsbi'
import { BigintIsh } from '../constants'

export interface Params {
  amountOut: TokenAmount
  blocked: boolean
  fee: TokenAmount
  deltaApplied: boolean
}

export interface BurnParams extends Params {
  feePercentage: JSBI
  omegaSlashingPercentage: JSBI
  slippage: JSBI
  reservesPTU: JSBI
}

export interface MintSyncParams extends Params {
  amountsToInvest: { sync: JSBI; async: JSBI }
  extraSlippagePercentage: JSBI
  feePercentage: JSBI
  isDerivedVFB: boolean
}
export interface MintAsyncParams extends Params {
  feePercentage: JSBI
}

export interface BurnAsyncParams extends Params {
  amountOut2: TokenAmount
  asyncBlocked: boolean
  feePercentage: JSBI
  omegaSlashingPercentage: JSBI
}

export interface PylonInfo {
  virtualAnchorBalance: BigintIsh
  virtualFloatBalance: BigintIsh
  muMulDecimals: BigintIsh
  gammaMulDecimals: BigintIsh
  strikeBlock: BigintIsh
  EMABlockNumber: BigintIsh
  gammaEMA: BigintIsh
  thisBlockEMA: BigintIsh
  lastRootKTranslated: BigintIsh
  formulaSwitch: boolean
  lastFloatAccumulator: BigintIsh
  lastOracleTimestamp: BigintIsh
  lastPrice: BigintIsh
  p2x: BigintIsh
  p2y: BigintIsh
}
export interface PairInfo {
  price0CumulativeLast: BigintIsh
  price1CumulativeLast: BigintIsh
  kLast: BigintIsh
}

export interface SyncAsyncParams {
  amountOut: JSBI
  amountPool: JSBI
  trueAmountOut: JSBI
  amounts: { sync: JSBI; async: JSBI }
  syncMinting?: { newReserve0: JSBI; newReserve1: JSBI; liquidity: JSBI; px: JSBI; py: JSBI }
}
