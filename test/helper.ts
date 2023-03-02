// import tests from './json/test-cases.json';
import axios from 'axios';
export interface TestInput {
  testCase: number
  isFloatRes0: boolean
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
  isBlocked: boolean,
  decimals: {
    anchor: string,
    float: string,
    priceMultiplier: string
  }
}
// export const CASES: TestInput[] = tests

export async function getOnlineCases():Promise<TestInput[]> {
  const url  = 'https://raw.githubusercontent.com/Zircon-Finance/zircon-protocol-2/develop/packages/zircon-core/test/shared/json/test-cases.json'
  const response = await axios.get(url)
  const cases:TestInput[] = response.data
  return cases
}
