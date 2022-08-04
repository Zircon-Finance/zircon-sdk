import {ChainId, Token, Pylon, Pair, TokenAmount, PylonFactory, ZERO} from '../src'
import JSBI from "jsbi";

describe('Pylon', () => {
    const USDC = new Token(ChainId.MOONBASE, '0x1FC56B105c4F0A1a8038c2b429932B122f6B631f', 18, 'USDC', 'USD Coin')
    const DAI = new Token(ChainId.MOONBASE, '0xe75F9ae61926FF1d27d16403C938b4cd15c756d5', 18, 'DAI', 'DAI Stablecoin')
    const FP = new Token(ChainId.MOONBASE, '0x821309aBA1372bfeF9F31FD23d8788876EB2E311', 18, 'ZR-FT', 'Zircon FT')
    const AP = new Token(ChainId.MOONBASE, '0x47E80813e669864E9C96d395A4e7AD6264412627', 18, 'ZR-AT', 'Zircon AT')

    const pylonFactory = new PylonFactory(JSBI.BigInt(4e16), JSBI.BigInt(100), JSBI.BigInt(1), JSBI.BigInt(50), JSBI.BigInt(10), JSBI.BigInt(30), JSBI.BigInt(2), JSBI.BigInt(240), JSBI.BigInt(3));

    describe('Pool tokens', () => {
        it('Calculating FPT and APT', () => {
            const  pylon = new Pylon(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')), new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100'))
            expect(pylon.floatLiquidityToken).toEqual(FP);
            expect(pylon.anchorLiquidityToken).toEqual(AP);
        })
    })

    describe('Async Minting', () => {
        const mintTestCases = [
            ['1846818181818181818181', '5757727272727272727272', '7727272727272727273', '24090909090909090909',
                '3260901012484607833844','259234808523880957500', "154545454545454545763", '25000000000000000000', '25000000000000000000', "481818181818181818181", "499999999999999999",
            "499999999999999999", 0, 0, 1517, 1, 0, 0, '16036154803521621182', 0],
            ['1871818181818181818181', '5782717002002466123649', '7727272727272727273', '24090909090909090909',
                '3275058419668609184526','273392214604330049512', "481818181818181818181", '25000000000000000000', '25000000000000000000', "481818181818181818181", "499999999999999999",
            "499999999999999999", "1549035935270", 0, 25, 23, 0, 0, '49994999919633531504', 1],
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
    describe('Async-100 Minting', () => {
        const mintTestCases = [
            ['2141162524756736007925', '4292920570742498093674', '1007475243263992075', '2624922592019514308',
                '3030467135304168959822', '28533531631974760953', "17169812048768911281", '535287500000000000000', "53000000000000000000", "401178944117337168", "401178944117337168",
            "35665759641431812", 696, 938, 696, 0, "98821055882662832", '474294320243215853583', 0],
        ].map(a => a.map(n => (JSBI.BigInt(n))))
        mintTestCases.forEach((mintCase, i) => {
            it('Calculating async minting' + i , () => {
                const pylon = new Pylon(new Pair(new TokenAmount(USDC, mintCase[0]), new TokenAmount(DAI, mintCase[1])), new TokenAmount(USDC, mintCase[2]), new TokenAmount(DAI, mintCase[3]))

                let totalSupply = new TokenAmount(pylon.pair.liquidityToken, mintCase[4])
                let ptb = new TokenAmount(pylon.pair.liquidityToken, mintCase[5])
                const isFloat = JSBI.equal(mintCase[18], ZERO)
                let ptTotalSupply = new TokenAmount(isFloat ? FP : AP, mintCase[6])
                let supply = new TokenAmount(USDC, mintCase[7])
                let liquidity: TokenAmount
                if (isFloat) {
                    liquidity = pylon.getFloatAsync100LiquidityMinted(totalSupply, ptTotalSupply, supply,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], mintCase[13], pylonFactory, mintCase[14], mintCase[15], mintCase[16])
                }else{
                    liquidity = pylon.getAnchorAsync100LiquidityMinted(totalSupply, ptTotalSupply, supply,
                        mintCase[8], mintCase[9], mintCase[10],
                        ptb, mintCase[11], mintCase[12], mintCase[13], pylonFactory, mintCase[14], mintCase[15], mintCase[16])
                }
                expect(liquidity.raw.toString()).toEqual(mintCase[17].toString())
            })
        })
    })
})

