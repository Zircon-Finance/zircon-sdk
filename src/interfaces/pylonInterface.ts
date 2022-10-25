import {TokenAmount} from "entities";
import JSBI from "jsbi";

export interface BurnParams {
    amount: TokenAmount,
    blocked: boolean,
    fee: TokenAmount,
    deltaApplied: boolean,
    feePercentage: JSBI,
    omegaSlashingPercentage :JSBI
}

export interface MintSyncParams {
    amountsToInvest: { sync: JSBI; async: JSBI };
    extraSlippagePercentage: JSBI;
    blocked: boolean;
    fee: TokenAmount;
    liquidity: TokenAmount;
    deltaApplied: boolean;
    feePercentage: JSBI;
    isDerivedVFB: boolean;
}
export interface MintAsyncParams {
    liquidity: TokenAmount,
    blocked: boolean,
    fee: TokenAmount,
    deltaApplied: boolean,
    feePercentage: JSBI
}

export interface BurnAsyncParams {
    amountA: TokenAmount,
    amountB: TokenAmount,
    blocked: boolean,
    fee: TokenAmount,
    deltaApplied: boolean,
    asyncBlocked: boolean,
    feePercentage: JSBI,
    omegaSlashingPercentage: JSBI
}
