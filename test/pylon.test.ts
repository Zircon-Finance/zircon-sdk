import {ChainId, Token, Pylon, Pair, TokenAmount, PylonFactory,} from '../src'
import JSBI from 'jsbi'
import {CASES} from "./helper";
import {BurnAsyncParams, Params, PylonInfo} from "interfaces/pylonInterface";
describe('Pylon', () => {
  const USDC = new Token(ChainId.STANDALONE, '0x21dF544947ba3E8b3c32561399E88B52Dc8b2823', 18, 'USDC', 'USD Coin')
  const DAI = new Token(ChainId.STANDALONE, '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584', 18, 'DAI', 'DAI Stablecoin')

  // const FP = new Token(ChainId.STANDALONE, '0xCF9a47aEf447639899cE2b7dFB77C33f8e07cc64', 18, 'ZR-FT', 'Zircon FT')
  // const AP = new Token(ChainId.STANDALONE, '0xd0eab14eF374344dA2732a871423470EDbA5915D', 18, 'ZR-AT', 'Zircon AT')
  // maximumPercentageSync: BigintIsh, deltaGammaThreshold: BigintIsh, deltaGammaMinFee: BigintIsh,  EMASamples: BigintIsh,
  //     muUpdatePeriod: BigintIsh, muChangeFactor: BigintIsh, liquidityFee: BigintIsh, dynamicRatio: BigintIsh,
  //     feePercentageRev: BigintIsh, feePercentageEnergy: BigintIsh, minFee: BigintIsh, maxFee: BigintIsh

  const pylonFactory = new PylonFactory(
      JSBI.BigInt(10),
      JSBI.BigInt(4e16),
      JSBI.BigInt(100),
      JSBI.BigInt(2),
      JSBI.BigInt(240),
      JSBI.BigInt(3),
      JSBI.BigInt(15),
      JSBI.BigInt(5),
      JSBI.BigInt(20),
      JSBI.BigInt(100),
      JSBI.BigInt(1),
      JSBI.BigInt(50),
      JSBI.BigInt(120)
  )

  describe('Pool tokens', () => {
    it('Calculating FPT and APT', () => {
      // const  pylon = new Pylon(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')), new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100'))
      // expect(pylon.floatLiquidityToken).toEqual(FP);
      // expect(pylon.anchorLiquidityToken).toEqual(AP);
    })
  })

  it('initPylon:!1', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(
        new TokenAmount(tokenA, '5000000000000000000'),
        new TokenAmount(tokenB, '10000000000000000000'),
        '1',
        pylonFactory.liquidityFee
    )
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '0'), new TokenAmount(tokenB, '0'))
    let init = pylon.initializeValues(
        new TokenAmount(pair.liquidityToken, '7071067811865475244'),
        new TokenAmount(tokenA, '50000000000000000'),
        new TokenAmount(tokenB, '100000000000000000')
    )
    expect(init[0].toString(10)).toEqual('49999999999999000')
    expect(init[1].toString(10)).toEqual('99999999999999000')
  })
  describe('Test Cases', () => {
    CASES.forEach((testCase, i) => {
      it('Test Case ' + i, () => {
        if (testCase.skip) {
          const pylon = new Pylon(
              new Pair(
                  new TokenAmount(USDC, testCase.resPair0),
                  new TokenAmount(DAI, testCase.resPair1),
                  testCase.lastBlockTimestamp,
                  pylonFactory.liquidityFee
              ),
              new TokenAmount(USDC, testCase.resPylon0),
              new TokenAmount(DAI, testCase.resPylon1)
          )

          pylonFactory.setMaxSync(testCase.maxSync ?? "10")
          let totalSupply = new TokenAmount(pylon.pair.liquidityToken, testCase.totalSupply)
          let ptb = new TokenAmount(pylon.pair.liquidityToken, testCase.ptb)
          const isLineFormula = testCase.fs
          const isFloat = !testCase.isAnchor
          let ptTotalSupply = new TokenAmount(
              isFloat ? pylon.floatLiquidityToken : pylon.anchorLiquidityToken,
              testCase.ptTotalSupply
          )
          let amount = new TokenAmount(isFloat ? USDC : DAI, testCase.amountIn)
          let result: Params
          let pylonInfo: PylonInfo = {
            virtualAnchorBalance: testCase.vab,
            muMulDecimals: testCase.mu,
            gammaMulDecimals: testCase.gamma,
            strikeBlock: testCase.strikeBlock,
            EMABlockNumber: testCase.EMABlockNumber,
            gammaEMA: testCase.gEMA,
            thisBlockEMA: testCase.thisBlockEMA,
            lastRootKTranslated: testCase.lrkt,
            anchorKFactor: testCase.akv,
            formulaSwitch: isLineFormula,
            lastFloatAccumulator: testCase.lastFloatAccumulator,
            lastOracleTimestamp: testCase.lastOracleTimestamp,
            lastPrice: testCase.lastPrice,
          }
          let pairInfo = {
            price0CumulativeLast: testCase.price0CumulativeLast,
            price1CumulativeLast: testCase.price1CumulativeLast,
            kLast: testCase.lastK
          }

          if (testCase.isBurn) {
            if (testCase.isSync) {
              if(isFloat) {
                result = pylon.burnFloat(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp
                )
              }else{
                let resPtEnergy = new TokenAmount(pylon.pair.liquidityToken, testCase.reservePtEnergy ?? "0")
                let resAnchorEnergy = new TokenAmount(pylon.token1, testCase.reserveAnchorEnergy ?? "0")
                result = pylon.burnAnchor(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp,
                    resPtEnergy,
                    resAnchorEnergy
                )
              }

            }else{
              if(isFloat) {
                result = pylon.burnAsyncFloat(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp,
                )
              }else{
                let resPtEnergy = new TokenAmount(pylon.pair.liquidityToken, testCase.reservePtEnergy ?? "0")
                let resAnchorEnergy = new TokenAmount(pylon.token1, testCase.reserveAnchorEnergy ?? "0")
                result = pylon.burnAsyncAnchor(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp,
                    resPtEnergy,
                    resAnchorEnergy,
                )
              }
              expect((result as BurnAsyncParams).amountOut2.raw.toString()).toEqual(testCase.amountOut2)
            }
          }else{
            if (testCase.isSync) {
              if (isFloat) {
                result = pylon.getFloatSyncLiquidityMinted(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp,
                )
              } else {
                result = pylon.getAnchorSyncLiquidityMinted(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp,
                )
              }
            }else{
              let amount1 = new TokenAmount( USDC  , testCase.amountIn)
              let amount2 = new TokenAmount( DAI, testCase.amountIn2 ?? "0")

              if (isFloat) {
                result = pylon.getFloatAsyncLiquidityMinted(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount1,
                    amount2,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp,
                )
              } else {
                result = pylon.getAnchorAsyncLiquidityMinted(
                    pylonInfo,
                    pairInfo,
                    totalSupply,
                    ptTotalSupply,
                    amount1,
                    amount2,
                    ptb,
                    testCase.blockNumber,
                    pylonFactory,
                    testCase.timestamp,
                )
              }
            }
          }
          expect(result.amountOut.raw.toString()).toEqual(testCase.amountOut)
          expect(result.blocked).toEqual(testCase.isBlocked)
        }
      })
    })
  })

})
