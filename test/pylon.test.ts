import {ChainId, Token, Pylon, Pair, TokenAmount, PylonFactory, ZERO} from '../src'
import JSBI from "jsbi";

describe('Pylon', () => {
    const USDC = new Token(ChainId.STANDALONE, '0x21dF544947ba3E8b3c32561399E88B52Dc8b2823', 18, 'USDC', 'USD Coin')
    const DAI = new Token(ChainId.STANDALONE, '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584', 18, 'DAI', 'DAI Stablecoin')

    const FP = new Token(ChainId.STANDALONE, '0xCF9a47aEf447639899cE2b7dFB77C33f8e07cc64', 18, 'ZR-FT', 'Zircon FT')
    const AP = new Token(ChainId.STANDALONE, '0xd0eab14eF374344dA2732a871423470EDbA5915D', 18, 'ZR-AT', 'Zircon AT')

    const pylonFactory = new PylonFactory(JSBI.BigInt(4e16), JSBI.BigInt(100), JSBI.BigInt(1), JSBI.BigInt(50), JSBI.BigInt(10), JSBI.BigInt(30), JSBI.BigInt(2), JSBI.BigInt(240), JSBI.BigInt(3), JSBI.BigInt(5));

    describe('Pool tokens', () => {
        it('Calculating FPT and APT', () => {
            const  pylon = new Pylon(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')), new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100'))
            expect(pylon.floatLiquidityToken).toEqual(FP);
            expect(pylon.anchorLiquidityToken).toEqual(AP);
        })
    })


    it('initPylon:!1', async () => {
        const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
        const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
        const pair = new Pair(new TokenAmount(tokenA, '5000000000000000000'), new TokenAmount(tokenB, '10000000000000000000'))
        const pylon = new Pylon(pair, new TokenAmount(tokenA, '0'), new TokenAmount(tokenB, '0'))
        let init = pylon.initializeValues(
            new TokenAmount(pair.liquidityToken, "7071067811865475244"),
            new TokenAmount(tokenA, "50000000000000000"),
            new TokenAmount(tokenB, "100000000000000000")
        )
        expect(init[0].toString(10)).toEqual('49999999999999000')
        expect(init[1].toString(10)).toEqual('99999999999999000')
    })




    // liquidityMinted:  45442261645859937
    // VALUES WE NEED
    //
    // Pylon Sync Reserve0 after mint:  21590909090909090
    // Pylon Sync Reserve1 after mint:  38653191671213737
    // Pylon Pair Reserve0 after initPylon:  5432954545454545455
    // Pylon Pair Reserve1 after initPylon:  10870450000000000001
    // ptb:  613892907991983213
    // ptt:  7684960719857458457
    // ftt:  454545454545454545
    // att:  909090909090909090
    // gamma:  498799510977290185
    // muuu:  498799510977290185
    // vab:  909090909090909090
    // gEMA:  0
    // akv:  1000008578633132464
    // fs:  false
    // lrkt:  613893113145093460
    // thisBlockEMA:  1200489022709813
    // EMABlockNumber:  24
    // strikeBlock:  0
    // blockNumber:  25
    // kLast:  59058660738636363646737704545454545455


    // ResPair0, resPair1, resPylon0, resPylon1,
    // totalSupply, ptb, ptTotalSupply, liquidity,
    // vab, mu, gamma,
    // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // lastRootK, anchorKFactor, isLineFormula


    describe('Burning', () => {
        const mintTestCases = [
            ['5432954545454545455', '10870450000000000001', '21590909090909090', '84090909090909089',
                '7684960719857458457','613892907991983213', "954533170736769027", '45442261645859937',
                '954533170736769027', '499999999999999998', "499999999999999998",
                0, 23, 22, 0, 2, "613893113145093460", "1000008578633132464", 1, "45437717419695352", 0, "59058660738636363646737704545454545455"],

            ['5432954545454545455', '10870450000000000001', '21590909090909090', '38653191671213737',
                '7684960719857458457','613892907991983213', "454545454545454545", '227272727272726772',
                '909090909090909090', '498799510977290185', "498799510977290185",
                0, 25, 24, 0, "1200489022709813", "613893113145093460", "1000008578633132464", 0, "225008320489675926", 0, "59058660738636363646737704545454545455"]
        ].map(a => a.map(n => (JSBI.BigInt(n))))
        mintTestCases.forEach((mintCase, i) => {
            it('Calculating async minting' + i , () => {
                const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))

                let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
                let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
                const isFloat = JSBI.equal(mintCase[18], ZERO)
                const isLineFormula = JSBI.equal(mintCase[20], ZERO)

                let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
                let liquidity = new TokenAmount(USDC, mintCase[7])
                let result: { amount: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean }
                if (isFloat) {
                    result = pylon.burnFloat(totalSupply, ptTotalSupply, liquidity,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21])
                }else{
                    result = pylon.burnAnchor(totalSupply, ptTotalSupply, liquidity,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21])
                }


                expect(result.amount.raw.toString()).toEqual(mintCase[19].toString())
            })
        })
    })


    // ResPair0, resPair1, resPylon0, resPylon1,
    // totalSupply, ptb, ptTotalSupply, amount1, amount2,
    // vab, mu, gamma,
    // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // lastRootK, anchorKFactor, isLineFormula

    // describe('Async Minting', () => {
    //     const mintTestCases = [
    //         ['1716150000000000000000', '5350350000000000000000', '850000000000000000', '2650000000000000000',
    //             '3030182032898353781669','28515828937626905325', "53000000000000000000", '34000000000000000000', '106000000000000000000',
    //             '53000000000000000000', "500000000000000000", "500000000000000000",
    //         0, 132, 0, 0, 0, "28515828937626905324", "1000000000000000000", 1, "211977961326582515044", 0, "9182003152500000000000000000000000000000000"],
    //         ['1846818181818181818181', '5757727272727272727272', '7727272727272727273', '24090909090909090909',
    //             '3260901012484607833844','259234808523880957500', "154545454545454545454", '25000000000000000000', '25000000000000000000',
    //             '481818181818181818181', "500000000000000000", "500000000000000000",
    //             0, 22, 0, 0, 0, "259234808523880957499", "1000000000000000000", 0, "16036154803521621119", 0, "10633475413223140495861714586776859504132232"],
    //
    //     ].map(a => a.map(n => (JSBI.BigInt(n))))
    //     mintTestCases.forEach((mintCase, i) => {
    //         it('Calculating async minting' + i , () => {
    //             const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))
    //
    //             let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
    //             let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
    //             const isFloat = JSBI.equal(mintCase[19], ZERO)
    //             const isLineFormula = JSBI.equal(mintCase[21], ZERO)
    //
    //             let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
    //             let floatSupply = new TokenAmount(USDC, mintCase[7])
    //             let anchorSupply = new TokenAmount(DAI, mintCase[8])
    //             let result: { liquidity: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean }
    //             if (isFloat) {
    //                 result = pylon.getFloatAsyncLiquidityMinted(totalSupply, ptTotalSupply, floatSupply, anchorSupply,
    //                     mintCase[9], mintCase[10], mintCase[11],
    //                     ptb, mintCase[12], mintCase[13], pylonFactory, mintCase[14], mintCase[15], mintCase[16], mintCase[17], mintCase[18], isLineFormula, mintCase[22])
    //             }else{
    //                 result = pylon.getAnchorAsyncLiquidityMinted(totalSupply, ptTotalSupply, floatSupply, anchorSupply,
    //                     mintCase[9], mintCase[10], mintCase[11],
    //                     ptb, mintCase[12], mintCase[13], pylonFactory, mintCase[14], mintCase[15], mintCase[16], mintCase[17], mintCase[18], isLineFormula, mintCase[22])
    //             }
    //
    //
    //             expect(result.liquidity.raw.toString()).toEqual(mintCase[20].toString())
    //         })
    //     })
    // })


    // ResPair0, resPair1, resPylon0, resPylon1,
    // totalSupply, ptb, ptTotalSupply, amount, vab, mu, gamma,
    // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // lastRootK, anchorKFactor, isLineFormula

    // describe('Sync Minting', () => {
    //     const mintTestCases = [
    //         ['10095000000000000000', '10095000000000000000', '5000000000000000', '5000000000000000',
    //             '10095000000000000000', '95000000000000000', "100000000000000000", '100000000000000000',
    //             "100000000000000000", "500000000000000000", "500000000000000000",
    //         0, 87, 0, 0, 0, '95000000000000000', '1000000000000000000', 0, "99613087934955011", 0,'0'],
    //         ['2141150000000000000000', '4292895527316389833901', '850000000000000000', '2650000000000000000',
    //             '3030182032898353781669', '28515828937626905325', "53000000000000000000", '1073223881829097458475',
    //             "53000000000000000000", "500000000000000000", "500000000000000000",
    //         0, 402, 0, 0, 0, "28515828937626905324", "1000000000000000000", 0, '1011591367385399537898', 1, "9182003152500000000000000000000000000000000"],
    //         ['1888707916071101051506', '4867710001459230380584', '1396445680834398792', '2306583060047714044',
    //             '3030627158256879875669', '28729719404410332336', "17679799328296919360", '170000000000000000',
    //             "53016723946225023458", "421742192263296076", "489671718861488206",
    //             455, 474, 470, "26192287777442155", "35059624334843266", "28740683078827603695", '1000702745091495749', 1, "169900662692317419", 0, "9191712338091756159333554528901800706721832"],
    //         ['1605979206654271083067', '5986328831820874640096', '850000000000000000', '2819626000000000000',
    //             '3090209236251101868499', '88543030789544860804', "265147587326582515044", '170000000000000000',
    //             "265147587326582515044", "161027828852633960", "161027828852633960",
    //             548, 699, 548, 0, "338972171147366039", "88543034411229793462", '1850510936446229982', 1, "169662705002277610", 1, "9549393905011303751364014400000000000000000"],
    //     ].map(a => a.map(n => (JSBI.BigInt(n))))
    //     mintTestCases.forEach((mintCase, i) => {
    //         it('Calculating async minting' + i , () => {
    //             const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))
    //
    //             let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
    //             let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
    //             const isLineFormula = JSBI.equal(mintCase[18], ZERO)
    //             const isFloat = JSBI.equal(mintCase[20], ZERO)
    //             let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
    //             let supply = new TokenAmount(isFloat ? USDC : DAI, mintCase[7])
    //             let result: { liquidity: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean }
    //             if (isFloat) {
    //                 result = pylon.getFloatSyncLiquidityMinted(totalSupply, ptTotalSupply, supply,
    //                     mintCase[8], mintCase[9], mintCase[10],
    //                     ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21])
    //             }else{
    //                 result = pylon.getAnchorSyncLiquidityMinted(totalSupply, ptTotalSupply, supply,
    //                     mintCase[8], mintCase[9], mintCase[10],
    //                     ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21])
    //             }
    //
    //             expect(result.liquidity.raw.toString()).toEqual(mintCase[19].toString())
    //         })
    //     })
    // })
})

