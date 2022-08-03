import {ChainId, Token, Pylon, Pair, TokenAmount, PylonFactory} from '../src'
import JSBI from "jsbi";

describe('Pylon', () => {
    const USDC = new Token(ChainId.MOONBASE, '0x1FC56B105c4F0A1a8038c2b429932B122f6B631f', 18, 'USDC', 'USD Coin')
    const DAI = new Token(ChainId.MOONBASE, '0xe75F9ae61926FF1d27d16403C938b4cd15c756d5', 18, 'DAI', 'DAI Stablecoin')
    const FP = new Token(ChainId.MOONBASE, '0x821309aBA1372bfeF9F31FD23d8788876EB2E311', 18, 'ZR-FT', 'Zircon FT')
    const AP = new Token(ChainId.MOONBASE, '0x47E80813e669864E9C96d395A4e7AD6264412627', 18, 'ZR-AT', 'Zircon AT')
    // const PT = new Token(ChainId.MOONBASE, '0x10AD3b25F0CD7Ed4EA01A95d2f1bf9E4bE987161', 18, 'ZR-AT', 'Zircon AT')


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
        it('Calculating async minting', () => {
            const pylonFactory = new PylonFactory(JSBI.BigInt(4e16), JSBI.BigInt(100), JSBI.BigInt(1), JSBI.BigInt(50), JSBI.BigInt(10), JSBI.BigInt(30), JSBI.BigInt(2), JSBI.BigInt(240), JSBI.BigInt(3));

            const pylon = new Pylon(new Pair(new TokenAmount(USDC, '1846818181818181818181'), new TokenAmount(DAI, '5757727272727272727272')), new TokenAmount(USDC, '7727272727272727273'), new TokenAmount(DAI, '24090909090909090909'))

            let totalSupply = new TokenAmount(pylon.pair.liquidityToken, '3260901012484607833844')
            let ptb = new TokenAmount(pylon.pair.liquidityToken, '259234808523880957500')
            //let anchorTotalSupply = new TokenAmount(AP, '481818181818181818181')
            let floatTotalSupply = new TokenAmount(FP, '154545454545454545763')
            let floatSupply = new TokenAmount(USDC, '25000000000000000000')
            let anchorSupply = new TokenAmount(DAI, '25000000000000000000')

            let liquidity = pylon.getFloatAsyncLiquidityMinted(totalSupply, floatTotalSupply, floatSupply, anchorSupply,
                JSBI.BigInt("481818181818181818181"), JSBI.BigInt("499999999999999999"), JSBI.BigInt("499999999999999999"),
                ptb, JSBI.BigInt(0), JSBI.BigInt(0), JSBI.BigInt(1517), pylonFactory, JSBI.BigInt(1), JSBI.BigInt(0), JSBI.BigInt(0))

            console.log("liquidity", liquidity.raw.toString())
        })
    })
})

