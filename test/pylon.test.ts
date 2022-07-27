import { ChainId, Token, Pylon } from '../src'

describe('Pylon', () => {
    const USDC = new Token(ChainId.MOONBASE, '0x1FC56B105c4F0A1a8038c2b429932B122f6B631f', 18, 'USDC', 'USD Coin')
    const DAI = new Token(ChainId.MOONBASE, '0xe75F9ae61926FF1d27d16403C938b4cd15c756d5', 18, 'DAI', 'DAI Stablecoin')


    describe('#token0', () => {
        it('always is the token that sorts before', () => {
            let liquidityAddresses = Pylon.getLiquidityAddresses(
                USDC,
                DAI,
            )

            console.log(liquidityAddresses)

        })
    })

})


// [
// '0x33677a5Fb779e41B539ef303748B61e7BA3c998d',
//     '0x8994D7DAbc82ef3a803dfe9b25709db0f33a63fD'
// ]

// [
// '0x4F93E463A263Bd4C3951D1Bf97F78231149FD5C3',
//     '0x48eFd7ED3eA242fE717fAfe0B1428103282Cdf8a'
// ]


