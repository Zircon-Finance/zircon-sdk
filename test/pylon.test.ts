import {ChainId, Token, Pylon, Pair, TokenAmount, PylonFactory, ZERO} from '../src'
import JSBI from "jsbi";

describe('Pylon', () => {
    const USDC = new Token(ChainId.STANDALONE, '0x21dF544947ba3E8b3c32561399E88B52Dc8b2823', 18, 'USDC', 'USD Coin')
    const DAI = new Token(ChainId.STANDALONE, '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584', 18, 'DAI', 'DAI Stablecoin')

    // const FP = new Token(ChainId.STANDALONE, '0xCF9a47aEf447639899cE2b7dFB77C33f8e07cc64', 18, 'ZR-FT', 'Zircon FT')
    // const AP = new Token(ChainId.STANDALONE, '0xd0eab14eF374344dA2732a871423470EDbA5915D', 18, 'ZR-AT', 'Zircon AT')
    // maximumPercentageSync: BigintIsh, deltaGammaThreshold: BigintIsh, deltaGammaMinFee: BigintIsh,  EMASamples: BigintIsh,
    //     muUpdatePeriod: BigintIsh, muChangeFactor: BigintIsh, liquidityFee: BigintIsh, dynamicRatio: BigintIsh,
    //     feePercentageRev: BigintIsh, feePercentageEnergy: BigintIsh, minFee: BigintIsh, maxFee: BigintIsh

    const pylonFactory = new PylonFactory(JSBI.BigInt(40), JSBI.BigInt(4e16),
        JSBI.BigInt(100), JSBI.BigInt(2), JSBI.BigInt(240),
        JSBI.BigInt(3),  JSBI.BigInt(30),
        JSBI.BigInt(5), JSBI.BigInt(20), JSBI.BigInt(100),
        JSBI.BigInt(1), JSBI.BigInt(50));

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










    // VALUES WE NEED
    //
    // Pylon Sync Reserve0 after mint:  1
    // Pylon Sync Reserve1 after mint:  45454545454545454
    // Pylon Pair Reserve0 after initPylon:  5409153158857936887
    // Pylon Pair Reserve1 after initPylon:  10863627283672073575
    // ptb:  594612520543233216
    // ptt:  7665680333212238551
    // ftt:  409090909090909191
    // att:  909090909090909090
    // gamma:  499999999999999998
    // muuu:  499999999999999998
    // vab:  909090909090909090
    // gEMA:  0
    // akv:  1000000000000000000
    // fs:  true
    // lrkt:  594614386802268880
    // thisBlockEMA:  2
    // EMABlockNumber:  4905
    // strikeBlock:  0
    // blockNumber:  4906
    // lastK:  58763023838130065187901484581770461025
    // END VALUES
    // ptb tokens ===>  90909090909090809
    // token1 exp ===> 90768785373484441
    // ptbEnergy:  49758483
    // a1Energy:  0


    // ResPair0, resPair1, resPylon0, resPylon1,
    // totalSupply, ptb, ptTotalSupply, liquidity,
    // vab, mu, gamma,
    // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // lastRootK, anchorKFactor, isFloat, result1, result2, isLineFormula, kLast

    describe('Burning', () => {
        const mintTestCases = [
            // ["12715597345705188563", "738186446229846943295", "736186446229846942295", "989468452182695327477",
            //     "996337574159940298", "999567437100068482", "2712945040040777471", "2626574",
            //     "2626776", "2626574", "837352761545224", "4839684281456063", "2717135833243112970",
            //     "12141450343561280125", "0", "162186328444482113521345539445731231312", "0", "0"],
            // ['5432954545454545455', '10870450000000000001', '21590909090909090', '84090909090909089',
            //     '7684960719857458457','613892907991983213', "954533170736769027", '45442261645859937',
            //     '954533170736769027', '499999999999999998', "499999999999999998",
            //     0, 23, 22, 0, 2, "613893113145093460", "1000008578633132464", 1, "45437717419695352", 0, "59058660738636363646737704545454545455", "0", "0"],
            // ['5432954545454545455', '10870450000000000001', '21590909090909090', '38653191671213737',
            //     '7684960719857458457','613892907991983213', "454545454545454545", '227272727272726772',
            //     '909090909090909090', '498799510977290185', "498799510977290185",
            //     0, 25, 24, 0, "1200489022709813", "613893113145093460", "1000008578633132464", 0, "225008320489675926", 0, "59058660738636363646737704545454545455", "0", "0"],
            // ['10095250120000000001', '5145364939021672441', '4849879999999999', '4624999999999999',
            //     '7207091457792298087','136023645905405573', "149366473384711075", '99366473384711075',
            //     '149366473384711075', '499999999999999998', "499999999999999998",
            //     72, 121, 72, 1, "245233600031875597", "136025713050063288", "1343255396566934696", 1, "98672814499432621", 1, "51943746018102331397751307859021672441", "0", "0"],
            ['5409153158857936887', '10863627283672073575', '1', '45454545454545454',
                '7665680333212238551','594612520543233216', "909090909090909090", '90909090909090809',
                '909090909090909090', '254766399968124392', "254766399968124392",
                0, 4906, 4905, 0, "2", "594614386802268880", "1000000000000000000", 1, "90768785373484441", 0, "58763023838130065187901484581770461025", "49758483", "0"],

        ].map(a => a.map(n => (JSBI.BigInt(n))))
        mintTestCases.forEach((mintCase, i) => {
            it('Burning' + i , () => {
                const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))

                let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
                let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
                const isFloat = JSBI.equal(mintCase[18], ZERO)
                const isLineFormula = JSBI.equal(mintCase[20], ZERO)

                let ptTotalSupply = new TokenAmount(isFloat ? pylon.floatLiquidityToken : pylon.anchorLiquidityToken, mintCase[6])
                let liquidity = new TokenAmount(USDC, mintCase[7])
                let result: { amount: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean }
                if (isFloat) {
                    result = pylon.burnFloat(totalSupply, ptTotalSupply, liquidity,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21])
                }else{
                    let ptbEnergy =  new TokenAmount(pylon.pair.liquidityToken, mintCase[22])
                    let a1Energy =  new TokenAmount(pylon.anchorLiquidityToken, mintCase[23])
                    result = pylon.burnAnchor(totalSupply, ptTotalSupply, liquidity,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21], ptbEnergy, a1Energy)
                }


                expect(result.amount.raw.toString()).toEqual(mintCase[19].toString())
            })
        })
    })
    //
    //
    // // ResPair0, resPair1, resPylon0, resPylon1,
    // // totalSupply, ptb, ptTotalSupply, liquidity,
    // // vab, mu, gamma,
    // // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // // lastRootK, anchorKFactor, isFloat, result1, result2, isLineFormula, kLast
    // describe('Burning Async', () => {
    //     const mintTestCases = [
    //         ['1601739312972445070805', '6090076300000000000004', '807499999999999999', '5072159999999999996',
    //             '3088945729564632477341','87279525603905600997', "262806084539709957223", '5245152113492748930',
    //             '262806084539709957223', '179726387453719553', "179726387453719553",
    //             72, 125, 72, 0, "320273612546280446", "87282157808787885051", "1827921151256990108", 1,
    //             "690424910634252638", "2625109061836215700", 1, "9542161245487750000012424846300000000000004", 0],
    //         ['1601739312972445070805', '6090076300000000000004', '807499999999999999', '5072159999999999996',
    //             '3088945729564632477341','87279525603905600997', "17000000000000000000", '5245152113492748930',
    //             '262806084539709957223', '179726387453719553', "179726387453719553",
    //             72, 125, 72, 0, "320273612546280446", "87282157808787885051", "1827921151256990108", 0,
    //             "3578131992801231441", "13604646318626897107", 1, "9542161245487750000012424846300000000000004", 0],
    //     ].map(a => a.map(n => (JSBI.BigInt(n))))
    //     mintTestCases.forEach((mintCase, i) => {
    //         it('Burning Async' + i , () => {
    //             const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))
    //
    //             let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
    //             let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
    //             const isFloat = JSBI.equal(mintCase[18], ZERO)
    //             const isLineFormula = JSBI.equal(mintCase[21], ZERO)
    //
    //             let ptTotalSupply = new TokenAmount(isFloat ? pylon.floatLiquidityToken : pylon.anchorLiquidityToken, mintCase[6])
    //             let liquidity = new TokenAmount(USDC, mintCase[7])
    //             let result: { amountA: TokenAmount; amountB: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean, asyncBlocked: boolean }
    //             if (isFloat) {
    //                 result = pylon.burnAsyncFloat(totalSupply, ptTotalSupply, liquidity,
    //                     mintCase[8], mintCase[9], mintCase[10],
    //                     ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[22])
    //             }else{
    //                 result = pylon.burnAsyncAnchor(totalSupply, ptTotalSupply, liquidity,
    //                     mintCase[8], mintCase[9], mintCase[10],
    //                     ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[22])
    //             }
    //             expect(result.amountA.raw.toString()).toEqual(mintCase[19].toString())
    //             expect(result.amountB.raw.toString()).toEqual(mintCase[20].toString())
    //             expect(result.asyncBlocked).toEqual(JSBI.equal(mintCase[23], ZERO))
    //         })
    //     })
    // })
    //
    //
    // // ResPair0, resPair1, resPylon0, resPylon1,
    // // totalSupply, ptb, ptTotalSupply, amount1, amount2,
    // // vab, mu, gamma,
    // // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // // lastRootK, anchorKFactor, isLineFormula
    //
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
    //             let ptTotalSupply = new TokenAmount(isFloat ? pylon.floatLiquidityToken : pylon.anchorLiquidityToken, mintCase[6])
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

    // sync 9901916406841877788338 5258815508979287068767578 1000000000000000000000
    // 32299888850512405116 653312465916462961 390877177469874716
    // 9897348803943551087591 2816115 2827570n
    // 2827568 5655573621581 913145605431176 10930347476488676349673 1058660209045977233 false 119582793946660966648800993669349648918689122
    // console.log("sync",  totalSupply.raw.toString(), ptTotalSupply.raw.toString(), tokenAmountA.raw.toString(),
    //     pylonInfo[0].toString(), pylonInfo[1].toString(), pylonInfo[2].toString(),
    //     pylonPoolBalance.raw.toString(),
    //     pylonInfo[3].toString(), BigInt(blockNumber),
    //     pylonInfo[4].toString(), pylonInfo[5].toString(), pylonInfo[6].toString(), pylonInfo[7].toString(), pylonInfo[8].toString(), pylonInfo[9].toString(), BigInt(lastK).toString())


    // sync 5394018682897903407350396 22529184879172716996 1078135401055044933833302 8702629621922484142 9981771027218405812125 5295446967914455545708501 1000000000000000000000 36253860171051364821 648602057860453719 388244228928823692 9977174856676473168929 2816115 2829122n PylonFactory 2829047 10830900198116 221717217903135 11018664073594951843050 1058660209045977233 false 121522844148718580048959121469077808716530416
    // pylon.ts:1258 SDK:: pairRes0, pairRes1, derVFB 5391535372187265462470051 22518809506481566999 5264790689817319059905597
    // pylon.ts:1259 SDK:: reserve0 1078135401055044933833302
    // pylon.ts:1263 SDK:: amountsToInvest Sync, Async 999600000000000000000 0
    // pylon.ts:1280 SDK:: amount 999600000000000000000
    // pylon.ts:1379 max0, max1, maxSync 1078307074437453092494010 4503761901296313399 40
    // pylon.ts:1301 SDK:: pairRes0New, pairRes1New, fee.newAmount 5392225395629090106733418 22521691525307152890 999600000000000000000
    // pylon.ts:1303 SDK:: reserve0New 1078307074437453092494010
    // pylon.ts:1330 SDK:: newGamma, newDerVFB, liquidity 388263343435603024 5265513995768088695122353 727517679152112254297

    // "virtualAnchorBalance",
    //     "muMulDecimals",
    //     "gammaMulDecimals",
    //     "strikeBlock",
    //     "EMABlockNumber",
    //     "gammaEMA",
    //     "thisBlockEMA",
    //     "lastRootKTranslated",
    //     "anchorKFactor",
    //     "formulaSwitch"

    // ResPair0, resPair1, resPylon0, resPylon1,
    // totalSupply, ptb, ptTotalSupply, amount,
    // vab, mu, gamma,
    // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // lastRootK, anchorKFactor, isLineFormula
    // describe('Sync Minting', () => {
    //     const mintTestCases = [
    //         ["5334985179361512073925563", "22414831518046047494", "1066270236140881153627892", "5006783678304040481",
    //             "9901916406841877788338","9897348803943551087591", "5258815508979287068767578", "1000000000000000000000",
    //             "32299888850512405116", "653312465916462961", "390877177469874716",
    //             "2816115", "2827570", "2827568", "5655573621581", "913145605431176", "10930347476488676349673",
    //             "1058660209045977233", "1", "7600000000","0", "119582793946660966648800993669349648918689122", "1"],
    //
    //         // ["48034992422798782590859", "9906782720445863851", "5078935103744823713363", "490026858322990000",
    //         //
    //         // "1000000000000000000", "1000000000000000000", "1048588936277297822485", "56200000000000000000000",
    //         // "36067971719053494660", "171594038967923493", "171594038967923493",
    //         // 961, 962, 961, "3667842842710135", "42334263900", "385477864726685879437", "1051514010963733824", 0, 0,  0, "11486787069072632840300213428324151079786456", 0],
    //         // ["2675441417242041866376", "4293417525439110016331", "2016082757958133624", "2020970142989043731",
    //         // "3387179871974646174580", "385246249362613540144", "1048588936277297822485", "53528750000000000",
    //         // "53017831306029522469", "400968200912562448", "400968200912562448",
    //         // 961, 962, 961, "3667842842710135", "42334263900", "385477864726685879437", "1003184034480717799", 0, 0, 0, "11486787069072632840300213428324151079786456", 0],
    //         //
    //         // ["2675441417242041866376", "4293417525439110016331", "2016082757958133624", "2020970142989043731",
    //         // "3387179871974646174580", "385246249362613540144", "53000000000000000000", "53528750000000000",
    //         // "53017831306029522469", "400968200912562448", "400968200912562448",
    //         // 961, 962, 961, "3667842842710135", "42334263900", "385477864726685879437", "1003184034480717799", 0, 0, 1, "11486787069072632840300213428324151079786456", 0],
    //         //
    //         // ['1009500000000000000000', '1009500000000000000000', '500000000000000000', '500000000000000000',
    //         //     '1009500000000000000000', '9500000000000000000', "10000000000000000000", '10000000000000000000',
    //         //     "10000000000000000000", "500000000000000000", "500000000000000000",
    //         // 0, 309, 0, 0, 0, '9500000000000000000', '1000000000000000000', 0, "9961318139684424591", 1,'1019090250000000000000000000000000000000000', 1],
    //         //
    //         // ['2141150000000000000000', '4292895527316389833901', '850000000000000000', '2650000000000000000',
    //         //     '3030182032898353781669', '28515828937626905325', "53000000000000000000", '1073223881829097458475',
    //         //     "53000000000000000000", "500000000000000000", "500000000000000000",
    //         // 0, 402, 0, 0, 0, "28515828937626905324", "1000000000000000000", 0, '1011591367385399537899', 1, "9182003152500000000000000000000000000000000", 1],
    //
    //         // ['1888707916071101051506', '4867710001459230380584', '1396445680834398792', '2306583060047714044',
    //         //     '3030627158256879875669', '28729719404410332336', "17667116449890567961", '170000000000000000',
    //         //     "53016723946225023458", "421742192263296076", "489671718861488206",
    //         //     1634, 1653, 1649, "26192287777442155", "35059624334843266", "28740683078827603695", '1000702745091495749', 1, "169777613093606843", 0, "9191712338091756159333554528901800706721832", 1],
    //         // ["15914876285694255995401", "15914876285694255995401", "95251985365998", "574590617817811503",
    //         //     "11046344473918413963", "1046344423919403551", "20890808633393131", "100000000000000000",
    //         //     "10099600000000000000", "950195242459314291", "950195242459314291",
    //         //      "2613915", "2618369" , "2613915", "0",
    //         //     "450195242459314291", "1046482601325736453", "1000001779983557796",
    //         //     "1","0","0", "122053956080767187013953861242498867578","1"],
    //
    //         // ["15914876285694255995401", "15914876285694255995401", "72836784945464", "674100617817811503",
    //         //     "11065056109135312124","1062407382041085577", "20890808633393131", "10000000000000000",
    //         //     "13637059531968493158", "995699500296932594", "995699500296932594",
    //         //     "2619325", "2619788", "2619325", "827564783932563", "45504257837618303", "1063825563869883122", "1000001779983557796",
    //         //     "1","1456993572784026","0", "122762557131014804910602749090638170487", "1"],
    //
    //         // ["230400000000000000000000", "1682523785678517776665", "6000000000000000000000", "175000000000000000000",
    //         //     "19674145470642428895744","19469206455323236928080", "120000000000000000000000", "3600000000000000000000",
    //         //     "3500000000000000000000", "500000000000000000", "500000000000000000",
    //         //     "0", "71", "0", "0", "0", "19469206455323236928119", "1000000000000000000",
    //         //     "0","3882108653574081840000","0", "387072000000000000000000000000000000000000000", "1"]
    //
    //         // ['1605979206654271083067', '5986328831820874640096', '850000000000000000', '2819626000000000000',
    //         //     '3090209236251101868499', '88543030789544860804', "265147587326582515044", '170000000000000000',
    //         //     "265147587326582515044", "161027828852633960", "161027828852633960",
    //         //     548, 699, 548, 0, "338972171147366039", "88543034411229793462", '1850510936446229982', 1, "169662705002277610", 1, "9549393905011303751364014400000000000000000", 1],
    //     ].map(a => a.map(n => (JSBI.BigInt(n))))
    //     mintTestCases.forEach((mintCase, i) => {
    //         it('Calculating sync minting ' + i , () => {
    //             const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))
    //
    //             let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
    //             let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
    //             const isLineFormula = JSBI.equal(mintCase[18], ZERO)
    //             const isFloat = JSBI.equal(mintCase[20], ZERO)
    //             let ptTotalSupply = new TokenAmount(isFloat ? pylon.floatLiquidityToken : pylon.anchorLiquidityToken, mintCase[6])
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
    //             expect(result.blocked).toEqual(JSBI.equal(mintCase[22], ZERO))
    //
    //         })
    //     })
    // })
})

