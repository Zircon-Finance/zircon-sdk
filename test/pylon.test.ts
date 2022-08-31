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

    // describe('Async Minting', () => {
    //     const mintTestCases = [
    //         ['1846818181818181818181', '5757727272727272727272', '7727272727272727273', '24090909090909090909',
    //             '3260901012484607833844','259234808523880957500', "154545454545454545763", '25000000000000000000', '25000000000000000000', "481818181818181818181", "499999999999999999",
    //         "499999999999999999", 0, 0, 1517, 1, 0, 0, '16036154803521621182', 0],
    //         ['1871818181818181818181', '5782717002002466123649', '7727272727272727273', '24090909090909090909',
    //             '3275058419668609184526','273392214604330049512', "481818181818181818181", '25000000000000000000', '25000000000000000000', "481818181818181818181", "499999999999999999",
    //         "499999999999999999", "1549035935270", 0, 25, 23, 0, 0, '49984999919649606405', 1],
    //     ].map(a => a.map(n => (JSBI.BigInt(n))))
    //     mintTestCases.forEach((mintCase, i) => {
    //         it('Calculating async minting' + i , () => {
    //             const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))
    //
    //             let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
    //             let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
    //             const isFloat = JSBI.equal(mintCase[19], ZERO)
    //             let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
    //             let floatSupply = new TokenAmount(USDC, mintCase[7])
    //             let anchorSupply = new TokenAmount(DAI, mintCase[8])
    //             let result: { liquidity: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean }
    //             if (isFloat) {
    //                 result = pylon.getFloatAsyncLiquidityMinted(totalSupply, ptTotalSupply, floatSupply, anchorSupply,
    //                     mintCase[9], mintCase[10], mintCase[11],
    //                     ptb, mintCase[12], mintCase[13], mintCase[14], pylonFactory, mintCase[15], mintCase[16], mintCase[17])
    //             }else{
    //                 result = pylon.getAnchorAsyncLiquidityMinted(totalSupply, ptTotalSupply, floatSupply, anchorSupply,
    //                     mintCase[9], mintCase[10], mintCase[11],
    //                     ptb, mintCase[12], mintCase[13], mintCase[14], pylonFactory, mintCase[15], mintCase[16], mintCase[17])
    //             }
    //
    //
    //             expect(result.liquidity.raw.toString()).toEqual(mintCase[18].toString())
    //         })
    //     })
    // })
    //
    // describe('Async-100 Minting', () => {
    //     const mintTestCases = [
    //         ['2141162524756736007925', '4292920570742498093674', '1007475243263992075', '2624922592019514308',
    //             '3030467135304168959822', '28533531631974760953', "17169812048768911281", '535287500000000000000', "53000000000000000000", "401178944117337168", "401178944117337168",
    //         "35665759641431812", 696, 938, 696, 0, "98821055882662832", '474294320243215853583', 0],
    //         ['2141150000000000000000', '4292895527316389833901', '850000000000000000', '2650000000000000000',
    //             '3030182032898353781669', '28515828937626905325', "53000000000000000000", '1073223881829097458475', "53000000000000000000", "500000000000000000", "500000000000000000",
    //         0, 0, 965, 0, 0, 0, '951347396625117035103', 1],
    //         ['1896818181818181818181', '5757711731298634491456', '7727272727272727273', '24090909090909090909',
    //             '3304674212778902757723', '303008006611074351024', "481818181818181818181", '50000000000000000000', "481818181818181818181", "499999999999999999", "499999999999999999",
    //         "3098063505589", 22, 23, 22, 0, 0, '16322645418062204210', 1, "33605000000000000000"],
    //
    //     ].map(a => a.map(n => (JSBI.BigInt(n))))
    //     mintTestCases.forEach((mintCase, i) => {
    //         it('Calculating async minting' + i , () => {
    //             const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))
    //
    //             let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
    //             let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
    //             const isFloat = JSBI.equal(mintCase[18], ZERO)
    //             let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
    //             let supply = new TokenAmount(isFloat ? USDC : DAI, mintCase[7])
    //             let result: { liquidity: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean }
    //             if (isFloat) {
    //                 result = pylon.getFloatAsync100LiquidityMinted(totalSupply, ptTotalSupply, supply,
    //                     mintCase[8], mintCase[9], mintCase[10],
    //                     ptb, mintCase[11], mintCase[12], mintCase[13], pylonFactory, mintCase[14], mintCase[15], mintCase[16])
    //             }else{
    //                 result = pylon.getAnchorAsync100LiquidityMinted(totalSupply, ptTotalSupply, supply,
    //                     mintCase[8], mintCase[9], mintCase[10],
    //                     ptb, mintCase[11], mintCase[12], mintCase[13], pylonFactory, mintCase[14], mintCase[15], mintCase[16])
    //             }
    //             if(result.deltaApplied) {
    //                 expect(result.fee.raw.toString()).toEqual(mintCase[19].toString())
    //
    //             }
    //             expect(result.liquidity.raw.toString()).toEqual(mintCase[17].toString())
    //         })
    //     })
    // })


    // VALUES WE NEED
    //
    // Pylon Sync Reserve0 after mint:  850000000000000000
    // Pylon Sync Reserve1 after mint:  2650000000000000000
    // Pylon Pair Reserve0 after initPylon:  2141150000000000000000
    // Pylon Pair Reserve1 after initPylon:  4292895527316389833901
    // ptb:  28515828937626905325
    // ptt:  3030182032898353781669
    // ftt:  17000000000000000000
    // att:  53000000000000000000
    // gamma:  500000000000000000
    // muuu:  500000000000000000
    // vab:  53000000000000000000
    // gEMA:  0
    // akv:  1000000000000000000
    // fs:  true
    // lrkt:  28515828937626905324
    // thisBlockEMA:  0
    // EMABlockNumber:  0
    // strikeBlock:  0
    // blockNumber:  402
    // fp:  0x32EEce76C2C2e8758584A83Ee2F522D4788feA0f
    // f:  0xfcDB4564c18A9134002b9771816092C9693622e3
    // pair:  0xB3eDbC1b7fd490B7c5ca76f9aCDce562DB33C828
    // pair:  0xB3eDbC1b7fd490B7c5ca76f9aCDce562DB33C828
    // pyLon:  0x67396d7A5005EB42B12886726db61859287dF836
    // tk0: 0x19cEcCd6942ad38562Ee10bAfd44776ceB67e923
    // tk1: 0xD42912755319665397FF090fBB63B1a31aE87Cee
    // ptk1: 0x7d2f8b6C1815C9419732CEcA253536077551b068
    // ptk0: 0xe53F8bD5CCA12E6b6057D60cb88bBC16d0241137
    // END VALUES

    // ResPair0, resPair1, resPylon0, resPylon1,
    // totalSupply, ptb, ptTotalSupply, amount, vab, mu, gamma,
    // strikeBlock, blockNumber, emaBlockNumber, gammaEMA, thisBlockEMA
    // lastRootK, anchorKFactor, isLineFormula
    describe('Sync Minting', () => {
        const mintTestCases = [
            ['10095000000000000000', '10095000000000000000', '5000000000000000', '5000000000000000',
                '10095000000000000000', '95000000000000000', "100000000000000000", '100000000000000000',
                "100000000000000000", "500000000000000000", "500000000000000000",
            0, 87, 0, 0, 0, '95000000000000000', '1000000000000000000', 0, "99613087934955011", 0,'0'],
            ['2141150000000000000000', '4292895527316389833901', '850000000000000000', '2650000000000000000',
                '3030182032898353781669', '28515828937626905325', "53000000000000000000", '1073223881829097458475',
                "53000000000000000000", "500000000000000000", "500000000000000000",
            0, 402, 0, 0, 0, "28515828937626905324", "1000000000000000000", 0, '1011591367385399537898', 1, "9182003152500000000000000000000000000000000"],
            // ['1888707885103963847162', '4867709921648550727259', '1396476637008672626', '2306662842472932714',
            //     '3030572982486210833802', '28729669716474079671', "17679461030877273969", '170000000000000000', "53015220098544079352", "421897783354351446", "489903949079438299",
            // 0, 558, 577, 573, "26177604733207785", "34894885256023595", '169760993048816447', 0],
            // ['1946900277984069401940', '5137801622619229845169', '7645176561385143514', '0',
            //     '3131360087166387336717', '129693883205660460373', "154545454545454545454", '1000', "1000", "499999999999999999", "499999999999999999",
            // 0,  22, 26, "22", "0", "0", '0', 1],
        ].map(a => a.map(n => (JSBI.BigInt(n))))
        mintTestCases.forEach((mintCase, i) => {
            it('Calculating async minting' + i , () => {
                const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))

                let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
                let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
                const isLineFormula = JSBI.equal(mintCase[18], ZERO)
                const isFloat = JSBI.equal(mintCase[20], ZERO)
                let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
                let supply = new TokenAmount(isFloat ? USDC : DAI, mintCase[7])
                let result: { liquidity: TokenAmount; blocked: boolean; fee: TokenAmount; deltaApplied: boolean }
                if (isFloat) {
                    result = pylon.getFloatSyncLiquidityMinted(totalSupply, ptTotalSupply, supply,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21])
                }else{
                    result = pylon.getAnchorSyncLiquidityMinted(totalSupply, ptTotalSupply, supply,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], pylonFactory, mintCase[13], mintCase[14], mintCase[15], mintCase[16], mintCase[17], isLineFormula, mintCase[21])
                }

                expect(result.liquidity.raw.toString()).toEqual(mintCase[19].toString())
            })
        })
    })
})

