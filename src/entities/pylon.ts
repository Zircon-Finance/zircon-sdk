import { TokenAmount } from './fractions/tokenAmount'
import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { pack, keccak256 } from '@ethersproject/solidity'
import { getCreate2Address } from '@ethersproject/address'

import {
    BigintIsh,
    PYLON_CODE_HASH,
    MINIMUM_LIQUIDITY,
    ZERO,
    ONE,
    FIVE,
    _997,
    _1000,
    ChainId, PYLON_FACTORY_ADDRESS, TWO, BASE, PT_CODE_HASH
} from '../constants'
import { sqrt, parseBigintIsh } from '../utils'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import { Token } from './token'
import {Pair} from "../entities";

// let PYLON_ADDRESS_CACHE: { [token0Address: string]: { [token1Address: string]: string } } = {}

export class Pylon {
    public readonly floatLiquidityToken: Token
    public readonly anchorLiquidityToken: Token
    public readonly pair: Pair
    private readonly tokenAmounts: [TokenAmount, TokenAmount]
    public readonly address: string


    public static getAddress(tokenA: Token, tokenB: Token): string {
        const pairAddress: string = Pair.getAddress(tokenA, tokenB);
        //console.log(tokenA, tokenB, pairAddress)

        return getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenA.chainId],
            keccak256(['bytes'], [pack(['address', 'address', 'address'], [tokenA.address, tokenB.address, pairAddress])]),
            PYLON_CODE_HASH
        )

        // if (PYLON_ADDRESS_CACHE?.[tokens[0].address]?.[tokens[1].address] === undefined) {
        //     PYLON_ADDRESS_CACHE = {
        //         ...PYLON_ADDRESS_CACHE,
        //         [tokens[0].address]: {
        //             ...PYLON_ADDRESS_CACHE?.[tokens[0].address],
        //             [tokens[1].address]: getCreate2Address(
        //                 PYLON_FACTORY_ADDRESS[tokens[0].chainId],
        //                 keccak256(['bytes'], [pack(['address', 'address', 'address'], [tokens[0].address, tokens[1].address, pairAddress])]),
        //                 PYLON_CODE_HASH
        //             )
        //         }
        //     }
        // }
        //
        // return PYLON_ADDRESS_CACHE[tokens[0].address][tokens[1].address]
    }

    public static getLiquidityAddresses(tokenA: Token, tokenB: Token): [string, string] {
        const pylonAddress = Pylon.getAddress(tokenA, tokenB);
        const floatLiquidityAddress = getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenA.chainId],
            keccak256(["bytes"], [pack(['address', 'address'], [tokenA.address, pylonAddress])]),
            PT_CODE_HASH
        )
        const anchorLiquidityAddress = getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenB.chainId],
            keccak256(["bytes"], [pack(['address', 'address'], [tokenB.address, pylonAddress])]),
            PT_CODE_HASH
        )

        return [floatLiquidityAddress, anchorLiquidityAddress]
    }


    public constructor(pair: Pair, tokenAmount0: TokenAmount, tokenAmount1: TokenAmount) {
        const tokenAmounts = [tokenAmount0, tokenAmount1];
        this.address = Pylon.getAddress(tokenAmounts[0].token, tokenAmounts[1].token);
        this.pair = pair

        const floatLiquidityAddress = getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenAmounts[0].token.chainId],
            keccak256(["bytes"], [pack(['address', 'address'], [tokenAmounts[0].token.address, this.address])]),
            PT_CODE_HASH
        )
        const anchorLiquidityAddress = getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenAmounts[1].token.chainId],
            keccak256(["bytes"], [pack(['address', 'address'], [tokenAmounts[1].token.address, this.address])]),
            PT_CODE_HASH
        )

        this.floatLiquidityToken = new Token(
            tokenAmounts[0].token.chainId,
            floatLiquidityAddress,
            18,
            'ZR-FT',
            'Zircon FT'
        )
        this.anchorLiquidityToken = new Token(
            tokenAmounts[0].token.chainId,
            anchorLiquidityAddress,
            18,
            'ZR-AT',
            'Zircon AT'
        )
        this.tokenAmounts = tokenAmounts as [TokenAmount, TokenAmount]
    }

    /**
     * Returns true if the token is either token0 or token1
     * @param token to check
     */
    public involvesToken(token: Token): boolean {
        return token.equals(this.token0) || token.equals(this.token1)
    }

    /**
     * Returns the chain ID of the tokens in the pair.
     */
    public get chainId(): ChainId {
        return this.token0.chainId
    }

    public get token0(): Token {
        return this.tokenAmounts[0].token
    }

    public get token1(): Token {
        return this.tokenAmounts[1].token
    }

    public get reserve0(): TokenAmount {
        return this.tokenAmounts[0]
    }

    public get reserve1(): TokenAmount {
        return this.tokenAmounts[1]
    }

    public getPairReserves(): [TokenAmount, TokenAmount] {
        if (this.token0.equals(this.pair.token0)) {
            return [this.pair.reserve0, this.pair.reserve1]
        }else{
            return [this.pair.reserve1, this.pair.reserve0]
        }
    }

    private sqrt(value: JSBI) {
        invariant(JSBI.greaterThan(value, ZERO), 'NEGATIVE')
        if (JSBI.lessThanOrEqual(value, TWO)) {
            return value;
        }

        function newtonIteration(n: JSBI, x0: JSBI): JSBI {
            const x1 = JSBI.signedRightShift(JSBI.add(JSBI.divide(n, x0), x0), ONE);

            if (JSBI.equal(x0, x1) || JSBI.equal(x0, JSBI.subtract(x1, ONE))) {
                return x0;
            }
            return newtonIteration(n, x1);
        }

        return newtonIteration(value, ONE);
    }

    private translateToPylon(toTranslate: JSBI, ptb: TokenAmount, ptt: TokenAmount) {
        return JSBI.divide(JSBI.multiply(toTranslate, ptb.raw), ptt.raw)
    }

    private updateSync(lastK: JSBI, vabLast: JSBI, vfbLast: JSBI, gamma: JSBI, ptb: TokenAmount, ptt: TokenAmount, lpt: JSBI): {gamma: JSBI, vab:JSBI} {
        let currentK =  this.sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw));
        // console.log(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw).toString(10))
        let tpva = this.translateToPylon(JSBI.multiply(TWO, this.getPairReserves()[1].raw), ptb, ptt);
        let tpvf = this.translateToPylon(JSBI.multiply(TWO, this.getPairReserves()[0].raw), ptb, ptt)

        let d = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(BASE,JSBI.multiply(this.sqrt(lastK), ptt.raw)), JSBI.multiply(currentK, lpt)))
        // console.log("d",d.toString(10))
        // console.log("lpt",lpt.toString(10))
        // console.log("ptt",ptt.raw.toString(10))
        let feeValueAnchor = JSBI.divide(JSBI.multiply(d, tpva), BASE);
        let feeValueFloat = JSBI.divide(JSBI.multiply(d, tpvf), BASE);
        // console.log("feev", feeValueFloat.toString(10))
        // console.log("feea", feeValueAnchor.toString(10))
        let vab = JSBI.add(vabLast, JSBI.divide(JSBI.multiply(feeValueAnchor, gamma), BASE));
        let vfb = JSBI.add(vfbLast, JSBI.divide(JSBI.multiply(feeValueFloat, JSBI.subtract(BASE, gamma)), BASE));
        // console.log("vab", vab.toString(10))
        // console.log("vfb", vfb.toString(10))
        let newGamma: JSBI;
        if (JSBI.lessThan(JSBI.subtract(vab, this.reserve1.raw), JSBI.divide(tpva, TWO))){
            newGamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(BASE,JSBI.subtract(vab, this.reserve1.raw)), tpva))
        }else {
            newGamma = JSBI.divide(JSBI.multiply(BASE,JSBI.subtract(vfb, this.reserve0.raw)), tpvf)
        }

        return {gamma: newGamma, vab};
    }


    private calculatePTU(isAnchor: boolean, tokenAmount: TokenAmount, ptt: TokenAmount, ptb: TokenAmount, ptTotalSupply: TokenAmount, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI{
        invariant(ptTotalSupply.token.equals(this.anchorLiquidityToken) || ptTotalSupply.token.equals(this.floatLiquidityToken), 'NEGATIVE')
        let liquidity: JSBI
        if (isAnchor) {
            if (JSBI.equal(ptTotalSupply.raw, ZERO)) {
                liquidity = JSBI.subtract(tokenAmount.raw, MINIMUM_LIQUIDITY)
            } else {
                liquidity = JSBI.divide(JSBI.multiply(ptTotalSupply.raw, tokenAmount.raw), anchorVirtualBalance!)
            }
        }else{
            let denominator: JSBI
            if (JSBI.equal(ptTotalSupply.raw, ZERO)) {
                denominator = JSBI.multiply(TWO, gamma!)
            }else{
                let pairReserveTranslated = this.translateToPylon(this.pair!.reserve0.raw, ptb, ptt);
                denominator = JSBI.add(JSBI.divide(JSBI.multiply(JSBI.multiply(pairReserveTranslated, gamma!), TWO), BASE), this.reserve0.raw)
            }

            if (JSBI.equal(ptTotalSupply.raw, ZERO)) {
                liquidity = JSBI.subtract(JSBI.divide(JSBI.multiply(BASE, tokenAmount.raw), denominator), MINIMUM_LIQUIDITY)
            }else {
                liquidity = JSBI.divide(JSBI.multiply(ptTotalSupply.raw, tokenAmount.raw), denominator)
            }
        }

        return liquidity
    }

    private getLiquidityFromPoolTokensLiquidity(tokenAmountA: TokenAmount, tokenAmountB: TokenAmount, totalSupply: TokenAmount, ptb: TokenAmount, ptTotalSupply: TokenAmount,
                                                isAnchor: boolean, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI {
        let amount: TokenAmount;
        if (isAnchor){
            let amountA = JSBI.divide(JSBI.multiply(this.getPairReserves()[1].raw, JSBI.multiply(tokenAmountA.raw, TWO)), this.getPairReserves()[0].raw);
            let amountB = JSBI.multiply(tokenAmountB.raw, TWO);
            amount = new TokenAmount(tokenAmountA.token, JSBI.greaterThan(amountA, amountB) ? amountB : amountA);
        }else{
            let amountA = JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, JSBI.multiply(tokenAmountB.raw, TWO)), this.getPairReserves()[1].raw);
            let amountB = JSBI.multiply(tokenAmountA.raw, TWO);
            amount = new TokenAmount(tokenAmountB.token, JSBI.greaterThan(amountA, amountB) ? amountB : amountA);
        }
        return this.calculatePTU(isAnchor, amount, totalSupply, ptb, ptTotalSupply, anchorVirtualBalance, gamma);
    }

    public reserveOf(token: Token): TokenAmount {
        invariant(this.involvesToken(token), 'TOKEN')
        return token.equals(this.token0) ? this.reserve0 : this.reserve1
    }

    public getOutputAmount(inputAmount: TokenAmount): [TokenAmount, Pair] {
        invariant(this.involvesToken(inputAmount.token), 'TOKEN')
        if (JSBI.equal(this.reserve0.raw, ZERO) || JSBI.equal(this.reserve1.raw, ZERO)) {
            throw new InsufficientReservesError()
        }
        const inputReserve = this.reserveOf(inputAmount.token)
        const outputReserve = this.reserveOf(inputAmount.token.equals(this.token0) ? this.token1 : this.token0)
        const inputAmountWithFee = JSBI.multiply(inputAmount.raw, _997)
        const numerator = JSBI.multiply(inputAmountWithFee, outputReserve.raw)
        const denominator = JSBI.add(JSBI.multiply(inputReserve.raw, _1000), inputAmountWithFee)
        const outputAmount = new TokenAmount(
            inputAmount.token.equals(this.token0) ? this.token1 : this.token0,
            JSBI.divide(numerator, denominator)
        )
        if (JSBI.equal(outputAmount.raw, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return [outputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
    }

    public getInputAmount(outputAmount: TokenAmount): [TokenAmount, Pair] {
        invariant(this.involvesToken(outputAmount.token), 'TOKEN')
        if (
            JSBI.equal(this.reserve0.raw, ZERO) ||
            JSBI.equal(this.reserve1.raw, ZERO) ||
            JSBI.greaterThanOrEqual(outputAmount.raw, this.reserveOf(outputAmount.token).raw)
        ) {
            throw new InsufficientReservesError()
        }

        const outputReserve = this.reserveOf(outputAmount.token)
        const inputReserve = this.reserveOf(outputAmount.token.equals(this.token0) ? this.token1 : this.token0)
        const numerator = JSBI.multiply(JSBI.multiply(inputReserve.raw, outputAmount.raw), _1000)
        const denominator = JSBI.multiply(JSBI.subtract(outputReserve.raw, outputAmount.raw), _997)
        const inputAmount = new TokenAmount(
            outputAmount.token.equals(this.token0) ? this.token1 : this.token0,
            JSBI.add(JSBI.divide(numerator, denominator), ONE)
        )
        return [inputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
    }

    public initializeValues(
        totalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
    ): [JSBI, JSBI] {
        let vab = tokenAmountB.raw
        let vfb = tokenAmountA.raw
        let denominator;

        if (JSBI.notEqual(this.getPairReserves()[0].raw, ZERO)) {
            denominator = JSBI.divide(JSBI.multiply(vab, this.getPairReserves()[0].raw), this.getPairReserves()[1].raw)
        } else {
            denominator = JSBI.divide(JSBI.multiply(vab, tokenAmountA.raw), tokenAmountB.raw)
        }
        let gamma = JSBI.divide(JSBI.multiply(BASE, vfb), JSBI.add(vfb, denominator));

        let liquidityFloat: JSBI = this.calculatePTU(false,  tokenAmountA, totalSupply, new TokenAmount(tokenAmountA.token, ZERO), new TokenAmount(this.floatLiquidityToken, ZERO), vab, gamma);
        let liquidityAnchor: JSBI = this.calculatePTU(true,  tokenAmountB, totalSupply, new TokenAmount(tokenAmountA.token, ZERO), new TokenAmount(this.anchorLiquidityToken, ZERO), vab, gamma);
        return [liquidityFloat, liquidityAnchor];
    }

    public getAnchorAsync100LiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gamma: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): TokenAmount {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token1), 'TOKEN')


        let halfAmountA = new TokenAmount(this.token1, JSBI.divide(tokenAmount.raw, TWO));
        let outputAmount = this.pair.getOutputAmount(halfAmountA)
        // console.log("halfAmountA", halfAmountA.raw.toString())
        // console.log("outputAmount", outputAmount[0].raw.toString())

        let liquidity = this.getAnchorAsyncLiquidityMinted(totalSupply, anchorTotalSupply, outputAmount[0], halfAmountA, anchorVirtualBalance, floatVirtualBalance, gamma, kLast, ptb, lastPoolToken)
        if (!JSBI.greaterThan(liquidity.raw, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.anchorLiquidityToken, liquidity.raw)
    }
    public getFloatAsync100LiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gamma: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): TokenAmount {
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token0), 'TOKEN')

        let halfAmountA = new TokenAmount(this.token0, JSBI.divide(tokenAmount.raw, TWO));
        let outputAmount = this.pair.getOutputAmount(halfAmountA)
        // console.log("halfAmountA", halfAmountA.raw.toString())
        // console.log("outputAmount", outputAmount[0].raw.toString())
        // console.log("reserve0", this.pair.reserve0.raw.toString())
        // console.log("reserve1", this.pair.reserve1.raw.toString())
        let liquidity = this.getFloatAsyncLiquidityMinted(totalSupply, floatTotalSupply, halfAmountA, outputAmount[0], anchorVirtualBalance, floatVirtualBalance, gamma, kLast, ptb, lastPoolToken)
        if (!JSBI.greaterThan(liquidity.raw, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return liquidity
    }

    public getAnchorAsyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gamma: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): TokenAmount {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        const tokenAmounts =  [tokenAmountA, tokenAmountB];
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gamma), ptb, totalSupply, parseBigintIsh(lastPoolToken))

        let liquidity = this.getLiquidityFromPoolTokensLiquidity(tokenAmountA, tokenAmountB, totalSupply, ptb, anchorTotalSupply, true, result.vab)

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.anchorLiquidityToken, liquidity)
    }


    public getFloatAsyncLiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        floatVirtualBalance: BigintIsh,
        gammaLast: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): TokenAmount {
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        // invariant((this.pair.token0.equals(this.token0) && this.pair.token1.equals(this.token1)) ||
        //     (this.pair.token0.equals(this.token1) && this.pair.token1.equals(this.token0)), 'LIQUIDITY')
        const tokenAmounts =  [tokenAmountA, tokenAmountB];
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gammaLast), ptb, totalSupply, parseBigintIsh(lastPoolToken))

        //let pairTokenAmount: TokenAmount = this.pair.getLiquidityMinted(totalSupply, tokenAmountA, tokenAmountB);
        //console.log("Liquidity Minted", pairTokenAmount.raw)
        let liquidity = this.getLiquidityFromPoolTokensLiquidity(tokenAmountA, tokenAmountB, totalSupply, ptb, floatTotalSupply, false, result.vab, result.gamma)
        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }

        return new TokenAmount(this.anchorLiquidityToken, liquidity)
    }

    public getAnchorSyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gammaLast: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): TokenAmount {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token1), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gammaLast), ptb, totalSupply, parseBigintIsh(lastPoolToken))

        let liquidity: JSBI = this.calculatePTU(true, tokenAmount, totalSupply, ptb, anchorTotalSupply, result.vab);

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.anchorLiquidityToken, liquidity)
    }

    public getFloatSyncLiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gammaLast: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh
    ): TokenAmount {
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        //invariant((pair.token0.equals(this.token0) && pair.token1.equals(this.token1)) || (pair.token0.equals(this.token1) && pair.token1.equals(this.token0)), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token0), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gammaLast), ptb, totalSupply, parseBigintIsh(lastPoolToken))


        let liquidity: JSBI = this.calculatePTU(false, tokenAmount,totalSupply, ptb, floatTotalSupply, result.vab, result.gamma);

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.floatLiquidityToken, liquidity)
    }

    private calculatePTUToAmount(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: JSBI,
        ptb: JSBI,
        gamma: JSBI,
        isAnchor: boolean): JSBI {
        if(isAnchor) {
            return JSBI.divide(JSBI.multiply(anchorVirtualBalance, tokenAmount.raw), floatTotalSupply.raw);
        }else{
            //(((_reserve0.mul(_gamma).mul(2)/1e18).add(_reservePylon0)).mul(_ptuAmount))/_totalSupply
            return JSBI.divide(JSBI.multiply(JSBI.add(JSBI.divide(JSBI.multiply(JSBI.multiply(JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, ptb), totalSupply.raw), gamma), TWO), BASE), this.reserve0.raw), tokenAmount.raw), floatTotalSupply.raw)
        }
    }
    private getOmegaSlashing(gamma: JSBI, vab: JSBI, ptb: TokenAmount, ptt: TokenAmount ) {
        return JSBI.divide(JSBI.multiply(this.translateToPylon(JSBI.multiply(this.getPairReserves()[1].raw, TWO), ptb, ptt), JSBI.subtract(BASE, gamma)), JSBI.subtract(vab, this.reserve1.raw))
    }

    private calculateLPTU(
        totalSupply: TokenAmount,
        ptTotalSupply: TokenAmount,
        tokenAmount: JSBI,
        anchorVirtualBalance: JSBI,
        gamma: JSBI,
        ptb: TokenAmount,
        isAnchor: boolean): JSBI {

        //this.calculateLPTU(totalSupply, floatTotalSupply, adjustedLiq, result.vab, result.gamma, ptb, false);

        let pylonShare: JSBI;
        let maxPoolTokens: JSBI;
        if(isAnchor) {
            pylonShare = JSBI.divide(
                JSBI.multiply(ptb.raw, JSBI.subtract(anchorVirtualBalance, this.reserve1.raw)),
                JSBI.multiply(TWO, this.translateToPylon(this.getPairReserves()[1].raw, ptb, totalSupply))
            );

            //_ptTotalSupply - (_ptTotalSupply.mul(_pylonReserve1) / virtualAnchorBalance) :
            maxPoolTokens = JSBI.subtract(ptTotalSupply, JSBI.divide(JSBI.multiply(ptTotalSupply, this.reserve1.raw), anchorVirtualBalance))

            //pylonShare = JSBI.add(pylonShare,
                JSBI.divide(
                    JSBI.multiply(pylonShare, this.reserve1.raw),
                    this.translateToPylon(JSBI.multiply(this.getPairReserves()[1].raw, TWO), ptb, totalSupply) ))
        }else{
            pylonShare = JSBI.divide(JSBI.multiply(gamma, ptb.raw), BASE)


            //_ptTotalSupply - (_ptTotalSupply.mul(_pylonReserve0) / (_reserve0.mul(2).mul(gammaMulDecimals) / 1e18).add(_pylonReserve0));
            maxPoolTokens = JSBI.subtract(ptTotalSupply, JSBI.divide(
                                                            JSBI.multiply(ptTotalSupply, this.reserve0.raw),
                                                            JSBI.add(this.reserve0.raw, JSBI.divide(
                                                                                            JSBI.multiply(JSBI.multiply(this.getPairReserves()[0].raw(), TWO), gamma),
                                                                                            BASE))))


            //pylonShare =  JSBI.add(pylonShare, JSBI.divide(JSBI.multiply(pylonShare, this.reserve0.raw), this.translateToPylon(JSBI.multiply(this.getPairReserves()[0].raw, TWO), ptb, totalSupply) ))

        }

        return JSBI.divide(
            JSBI.multiply(pylonShare, tokenAmount),
            maxPoolTokens)
    }

    public burnFloat(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gammaLast: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): TokenAmount {
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gammaLast), ptb, totalSupply, parseBigintIsh(lastPoolToken))
        let reservesPTU = this.calculatePTU(false, this.reserve0, totalSupply, ptb, floatTotalSupply, result.vab, result.gamma);
        let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU;

        let amount = this.calculatePTUToAmount(
            totalSupply,
            floatTotalSupply,
            new TokenAmount(tokenAmountOut.token, minAmount),
            result.vab,
            result.gamma,
            ptb.raw,
            false
        )
        if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {
            let adjustedLiq = JSBI.subtract(tokenAmountOut.raw, reservesPTU);
            // console.log("adjustedLiq", adjustedLiq.toString(10))
            let lptu = this.calculateLPTU(totalSupply, floatTotalSupply, adjustedLiq, result.vab, result.gamma, ptb, false);
            // console.log("lptu", lptu.toString(10))

            //604705541361411447
            let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
            let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);
            let newPair = new Pair(new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
                new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)));

            let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token1, amount1));
            // console.log("amount", amount.toString(10))

            amount = JSBI.add(amount, JSBI.add(amount0, amountTransformed[0].raw));
            // console.log("amount", amount.toString(10))

        }
        return  new TokenAmount(tokenAmountOut.token, amount);
    }
    public burnAnchor(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gammaLast: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): TokenAmount {
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gammaLast), ptb, totalSupply, parseBigintIsh(lastPoolToken))
        let reservesPTU = this.calculatePTU(true, this.reserve1, totalSupply, ptb, anchorTotalSupply, result.vab, result.gamma);
        let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU;
        let amount = this.calculatePTUToAmount(
            totalSupply,
            anchorTotalSupply,
            new TokenAmount(tokenAmountOut.token, minAmount),
            result.vab,
            result.gamma,
            ptb.raw,
            true
        )
        // console.log("reservesPTU", reservesPTU.toString(10), tokenAmountOut.raw.toString(10))

        if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {
            // console.log("here")
            let omega = this.getOmegaSlashing(result.gamma, result.vab, ptb, totalSupply);
            console.log("omega", omega.toString(10))

            let adjustedLiq = JSBI.divide(JSBI.multiply(omega, JSBI.subtract(tokenAmountOut.raw, reservesPTU)), BASE);
            let lptu = this.calculateLPTU(totalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, ptb, true);
            // console.log("lptu", lptu.toString(10))

            let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
            let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);
            // console.log(amount0.toString(10), amount1.toString(10))
            let newPair = new Pair(new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
                new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)));

            let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token0, amount0));
            // console.log("amount", amount.toString(10))

            amount = JSBI.add(amount, JSBI.add(amount1, amountTransformed[0].raw));
            // console.log("amount", amount.toString(10))

        }
        return new TokenAmount(tokenAmountOut.token, amount);
    }

    public burnAsyncAnchor(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gammaLast: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): [TokenAmount, TokenAmount] {
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gammaLast), ptb, totalSupply, parseBigintIsh(lastPoolToken))
        let omega = this.getOmegaSlashing(result.gamma, result.vab, ptb, totalSupply);
        console.log("omega", omega.toString(10))
        let adjustedLiq = JSBI.divide(JSBI.multiply(omega, tokenAmountOut.raw), BASE)
        let lptu = this.calculateLPTU(totalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, ptb, true);
        let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
        let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);

        return [new TokenAmount(this.token0, amount0), new TokenAmount(this.token1, amount1)];
    }

    public burnAsyncFloat(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        floatVirtualBalance: BigintIsh,
        gammaLast: BigintIsh,
        kLast: BigintIsh,
        ptb: TokenAmount,
        lastPoolToken: BigintIsh,
    ): [TokenAmount, TokenAmount] {
        let result = this.updateSync(parseBigintIsh(kLast), parseBigintIsh(anchorVirtualBalance),  parseBigintIsh(floatVirtualBalance), parseBigintIsh(gammaLast), ptb, totalSupply, parseBigintIsh(lastPoolToken))

        //TODO: Add Omega Slashing

        let lptu = this.calculateLPTU(totalSupply, floatTotalSupply, tokenAmountOut.raw, result.vab, result.gamma, ptb, false);
        let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
        let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);


        return [new TokenAmount(this.token0, amount0), new TokenAmount(this.token1, amount1)];
    }

    public getLiquidityValue(
        token: Token,
        totalSupply: TokenAmount,
        liquidity: TokenAmount,
        feeOn: boolean = false,
        kLast?: BigintIsh
    ): TokenAmount {
        invariant(this.involvesToken(token), 'TOKEN')
        invariant(totalSupply.token.equals(this.anchorLiquidityToken) || totalSupply.token.equals(this.floatLiquidityToken), 'TOTAL_SUPPLY')
        invariant(liquidity.token.equals(this.anchorLiquidityToken) || liquidity.token.equals(this.floatLiquidityToken), 'LIQUIDITY')
        invariant(JSBI.lessThanOrEqual(liquidity.raw, totalSupply.raw), 'LIQUIDITY')

        let totalSupplyAdjusted: TokenAmount
        if (!feeOn) {
            totalSupplyAdjusted = totalSupply
        } else {
            invariant(!!kLast, 'K_LAST')
            const kLastParsed = parseBigintIsh(kLast)
            if (!JSBI.equal(kLastParsed, ZERO)) {
                const rootK = sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw))
                const rootKLast = sqrt(kLastParsed)
                if (JSBI.greaterThan(rootK, rootKLast)) {
                    const numerator = JSBI.multiply(totalSupply.raw, JSBI.subtract(rootK, rootKLast))
                    const denominator = JSBI.add(JSBI.multiply(rootK, FIVE), rootKLast)
                    const feeLiquidity = JSBI.divide(numerator, denominator)
                    totalSupplyAdjusted = totalSupply.add(new TokenAmount(liquidity.token, feeLiquidity))
                } else {
                    totalSupplyAdjusted = totalSupply
                }
            } else {
                totalSupplyAdjusted = totalSupply
            }
        }

        return new TokenAmount(
            token,
            JSBI.divide(JSBI.multiply(liquidity.raw, this.reserveOf(token).raw), totalSupplyAdjusted.raw)
        )
    }
}

