import tests from './json/test-cases.json';
export interface TestInput {
  resPair0:  string
  resPair1:  string
  resPylon0:  string
  resPylon1:  string
  totalSupply:  string
  ptb:  string
  anchorTotalSupply:  string
  floatTotalSupply:  string
  gamma:  string
  mu:  string
  vab:  string
  vfb:  string
  gEMA:  string
  fs: boolean
  isAnchor: boolean
  isBlocked: boolean
  lrkt:  string
  thisBlockEMA:  string
  EMABlockNumber:  string
  strikeBlock:  string
  lastFloatAccumulator:  string
  blockNumber:  string,
  timestamp: string,
  lastK:  string
  price0CumulativeLast:  string
  price1CumulativeLast:  string
  amountOut:  string
  amountOut2?:  string // For Burn Async Case
  amountIn:  string
  amountIn2?:  string // For Async use case
  lastOracleTimestamp:  string
  lastBlockTimestamp:  string
  skip: boolean
  maxSync?:  string
  isSync: boolean
  isBurn: boolean
  reservePtEnergy?:  string
  reserveAnchorEnergy?: string,
  lastPrice:  string
  p2x:  string,
  p2y:  string,
  decimals: {
    anchor: string,
    float: string
  }
}
export const CASES: TestInput[] = tests
