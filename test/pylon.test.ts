import {ChainId, Token, Pylon, Pair, TokenAmount, PylonFactory, ZERO} from '../src'
import JSBI from "jsbi";

describe('Pylon', () => {
    const USDC = new Token(ChainId.MOONBASE, '0x1FC56B105c4F0A1a8038c2b429932B122f6B631f', 18, 'USDC', 'USD Coin')
    const DAI = new Token(ChainId.MOONBASE, '0xe75F9ae61926FF1d27d16403C938b4cd15c756d5', 18, 'DAI', 'DAI Stablecoin')
    const FP = new Token(ChainId.MOONBASE, '0x821309aBA1372bfeF9F31FD23d8788876EB2E311', 18, 'ZR-FT', 'Zircon FT')
    const AP = new Token(ChainId.MOONBASE, '0x47E80813e669864E9C96d395A4e7AD6264412627', 18, 'ZR-AT', 'Zircon AT')
    // const PT = new Token(ChainId.MOONBASE, '0x10AD3b25F0CD7Ed4EA01A95d2f1bf9E4bE987161', 18, 'ZR-AT', 'Zircon AT')
    const pylonFactory = new PylonFactory(JSBI.BigInt(4e16), JSBI.BigInt(100), JSBI.BigInt(1), JSBI.BigInt(50), JSBI.BigInt(10), JSBI.BigInt(30), JSBI.BigInt(2), JSBI.BigInt(240), JSBI.BigInt(3));


    describe('Pool tokens', () => {
        it('Calculating FPT and APT', () => {
            const  pylon = new Pylon(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')), new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100'))
            expect(pylon.floatLiquidityToken).toEqual(FP);
            expect(pylon.anchorLiquidityToken).toEqual(AP);
        })
    })


    // Pylon Sync Reserve0 after mint:  7.727272727272727273
    // Pylon Sync Reserve1 after mint:  24.090909090909090909
    // Pylon Pair Reserve0 after initPylon:  1846.818181818181818181
    // Pylon Pair Reserve1 after initPylon:  5757.727272727272727272
    // ptb:  259.2348085238809575
    // ptt:  3260.901012484607833844
    // ftt:  154.545454545454545763
    // att:  481.818181818181818181
    // gamma:  0.499999999999999999
    // muuu:  0.499999999999999999
    // vab:  481.818181818181818181
    // gEMA:  0.0
    // feeValueAnchor1:  0.0
    // feeValueAnchor0:  0.0
    // thisBlockEMA:  0.0
    // strikeBlock:  0.0
    // blockNumber:  2403

    // Pylon Sync Reserve0 after mint:  7.727272727272727273
    // Pylon Sync Reserve1 after mint:  24.090909090909090909
    // Pylon Pair Reserve0 after initPylon:  1846.818181818181818181
    // Pylon Pair Reserve1 after initPylon:  5757.727272727272727272
    // ptb:  259.2348085238809575
    // ptt:  3260.901012484607833844
    // ftt:  154.545454545454545763
    // att:  481.818181818181818181
    // gamma:  0.499999999999999999
    // muuu:  0.499999999999999999
    // vab:  481.818181818181818181
    // gEMA:  0.0
    // EMABlockNumber:  0.0
    // feeValueAnchor1:  0.0
    // feeValueAnchor0:  0.0
    // thisBlockEMA:  0.0
    // strikeBlock:  0.0
    // blockNumber:  1517
    // VALUES WE NEED
    //
    // Pylon Sync Reserve0 after mint:  7727272727272727273
    // Pylon Sync Reserve1 after mint:  24090909090909090909
    // Pylon Pair Reserve0 after initPylon:  1846818181818181818181
    // Pylon Pair Reserve1 after initPylon:  5757727272727272727272
    // ptb:  259234808523880957500
    // ptt:  3260901012484607833844
    // ftt:  154545454545454545763
    // att:  481818181818181818181
    // gamma:  499999999999999999
    // muuu:  499999999999999999
    // vab:  481818181818181818181
    // gEMA:  0
    // EMABlockNumber:  0
    // feeValueAnchor1:  0
    // feeValueAnchor0:  0
    // thisBlockEMA:  0
    // strikeBlock:  0
    // blockNumber:  22
    // END VALUES

    describe('Async Minting', () => {
        const mintTestCases = [
            ['1846818181818181818181', '5757727272727272727272', '7727272727272727273', '24090909090909090909',
                '3260901012484607833844','259234808523880957500', "154545454545454545763", '25000000000000000000', '25000000000000000000', "481818181818181818181", "499999999999999999",
            "499999999999999999", 0, 0, 1517, 1, 0, 0, '16036132075471698175', 0],
        ].map(a => a.map(n => (JSBI.BigInt(n))))
        mintTestCases.forEach((mintCase, i) => {
            it('Calculating async minting' + i , () => {
                const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))

                let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
                let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
                const isFloat = JSBI.equal(mintCase[19], ZERO)
                let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
                let floatSupply = new TokenAmount(USDC, mintCase[7])
                let anchorSupply = new TokenAmount(DAI, mintCase[8])
                let liquidity: TokenAmount
                if (isFloat) {
                    liquidity = pylon.getFloatAsyncLiquidityMinted(totalSupply, ptTotalSupply, floatSupply, anchorSupply,
                        mintCase[9], mintCase[10], mintCase[11],
                        ptb, mintCase[12], mintCase[13], mintCase[14], pylonFactory, mintCase[15], mintCase[16], mintCase[17])
                }else{
                    liquidity = pylon.getAnchorAsyncLiquidityMinted(totalSupply, ptTotalSupply, floatSupply, anchorSupply,
                        mintCase[9], mintCase[10], mintCase[11],
                        ptb, mintCase[12], mintCase[13], mintCase[14], pylonFactory, mintCase[15], mintCase[16], mintCase[17])
                }


                expect(liquidity.raw.toString()).toEqual(mintCase[18].toString())
            })
        })
    })
})

