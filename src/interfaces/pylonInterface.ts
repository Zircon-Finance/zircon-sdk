import { TokenAmount } from 'entities'
import JSBI from 'jsbi'

export interface Params {
  amountOut: TokenAmount;
  blocked: boolean;
  fee: TokenAmount;
  deltaApplied: boolean
}

export interface BurnParams extends Params {
  feePercentage: JSBI
  omegaSlashingPercentage: JSBI
  slippage: JSBI
  reservesPTU: JSBI
}

export interface MintSyncParams extends Params{
  amountsToInvest: { sync: JSBI; async: JSBI }
  extraSlippagePercentage: JSBI
  feePercentage: JSBI
  isDerivedVFB: boolean
}
export interface MintAsyncParams  extends Params{
  feePercentage: JSBI
}

export interface BurnAsyncParams  extends Params {
  amountOut2: TokenAmount
  asyncBlocked: boolean
  feePercentage: JSBI
  omegaSlashingPercentage: JSBI
}
