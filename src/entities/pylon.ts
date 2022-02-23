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
    ChainId, PYLON_FACTORY_ADDRESS, TWO
} from '../constants'
import { sqrt, parseBigintIsh } from '../utils'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import { Token } from './token'
import {Pair} from "../entities";

let PYLON_ADDRESS_CACHE: { [token0Address: string]: { [token1Address: string]: string } } = {}

export class Pylon {
    public readonly floatLiquidityToken: Token
    public readonly anchorLiquidityToken: Token
    public readonly pair: Pair
    private readonly tokenAmounts: [TokenAmount, TokenAmount]

    public static getAddress(tokenA: Token, tokenB: Token): string {
        const tokens = [tokenA, tokenB]; // does safety checks
        const pairAddress: string = Pair.getAddress(tokenA, tokenB);

        if (PYLON_ADDRESS_CACHE?.[tokens[0].address]?.[tokens[1].address] === undefined) {
            PYLON_ADDRESS_CACHE = {
                ...PYLON_ADDRESS_CACHE,
                [tokens[0].address]: {
                    ...PYLON_ADDRESS_CACHE?.[tokens[0].address],
                    [tokens[1].address]: getCreate2Address(
                        PYLON_FACTORY_ADDRESS[tokens[0].chainId],
                        keccak256(['bytes'], [pack(['address', 'address', 'address'], [tokens[0].address, tokens[1].address, pairAddress])]),
                        PYLON_CODE_HASH
                    )
                }
            }
        }

        return PYLON_ADDRESS_CACHE[tokens[0].address][tokens[1].address]
    }

    public constructor(pair: Pair) {
        const tokenAmounts = [pair.reserve0, pair.reserve1];
        const pylonAddress = Pylon.getAddress(tokenAmounts[0].token, tokenAmounts[1].token);
        this.pair = pair
        const floatLiquidityAddress = getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenAmounts[0].token.chainId],
            keccak256(["bytes"], [pack(['address', 'address'], [tokenAmounts[0].token.address, pylonAddress])]),
            PYLON_CODE_HASH
        )
        const anchorLiquidityAddress = getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenAmounts[1].token.chainId],
            keccak256(["bytes"], [pack(['address', 'address'], [tokenAmounts[1].token.address, pylonAddress])]),
            PYLON_CODE_HASH
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

    private sqrt(value: JSBI) {
        invariant(JSBI.lessThanOrEqual(value, ZERO), 'NEGATIVW')
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
        return JSBI.multiply(JSBI.divide(ptb.raw, ptt.raw), toTranslate)
    }

    private updateSync(lastK: JSBI, vabLast: JSBI, vfbLast: JSBI, gamma: JSBI, ptb: TokenAmount, ptt: TokenAmount, lpt: TokenAmount): [JSBI, JSBI] {
        let currentK =  this.sqrt(JSBI.multiply(this.pair.reserve0.raw, this.pair.reserve1.raw));
        let tpva = this.translateToPylon(JSBI.multiply(TWO, this.pair.reserve1.raw), ptb, ptt);
        let tpvf = this.translateToPylon(JSBI.multiply(TWO, this.pair.reserve0.raw), ptb, ptt)
        let d = JSBI.subtract(ONE, JSBI.divide(JSBI.multiply(this.sqrt(lastK), ptt.raw), JSBI.multiply(currentK, lpt.raw)))
        let feeValueAnchor = JSBI.multiply(d, tpva);
        let feeValueFloat = JSBI.multiply(d, tpvf);

        let vab = JSBI.add(vabLast, JSBI.multiply(feeValueAnchor, gamma);
        let vfb = JSBI.add(vfbLast, JSBI.multiply(feeValueFloat, JSBI.subtract(ONE, gamma)));
        let newGamma: JSBI;
        if (JSBI.lessThan(JSBI.subtract(vab, this.reserve1.raw), JSBI.divide(tpva, TWO))){
            newGamma = JSBI.subtract(ONE, JSBI.divide(JSBI.subtract(vab, this.reserve1.raw), tpva))
        }else {
            newGamma = JSBI.subtract(ONE, JSBI.divide(JSBI.subtract(vfb, this.reserve0.raw), tpvf))
        }

        return [newGamma, vab];
    }


    private calculatePTU(isAnchor: boolean, tokenAmount: TokenAmount, totalSupply: TokenAmount, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI{
        let liquidity: JSBI
        if (isAnchor) {
            if (JSBI.equal(totalSupply.raw, ZERO)) {
                liquidity = JSBI.subtract(JSBI.divide(tokenAmount.raw, anchorVirtualBalance!), MINIMUM_LIQUIDITY)
            } else {
                liquidity = JSBI.subtract(JSBI.multiply(JSBI.divide(tokenAmount.raw, anchorVirtualBalance!), totalSupply.raw), MINIMUM_LIQUIDITY)
            }
        }else{
            let reserveTranslated: JSBI
            if (JSBI.equal(this.pair!.reserve0.raw, ZERO)) {
                reserveTranslated = JSBI.multiply(TWO, gamma!)
            }else{
                reserveTranslated = JSBI.add(JSBI.multiply(JSBI.multiply(this.pair!.reserve0.raw, gamma!), TWO), this.reserve0.raw)
            }

            if (JSBI.equal(totalSupply.raw, ZERO)) {
                liquidity = JSBI.subtract(JSBI.divide(tokenAmount.raw, reserveTranslated), MINIMUM_LIQUIDITY)
            }else {
                liquidity = JSBI.multiply(JSBI.divide(tokenAmount.raw, reserveTranslated), totalSupply.raw)
            }
        }

        return liquidity
    }

    private getLiquidityFromPoolTokensLiquidity(tokenAmountA: TokenAmount, tokenAmountB: TokenAmount, totalSupply: TokenAmount,
                                                isAnchor: boolean, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI {
        let amount: TokenAmount;
        if (isAnchor){
            let amountA = JSBI.multiply(JSBI.divide(JSBI.multiply(tokenAmountA.raw, TWO), this.pair.reserve1.raw), this.pair.reserve0.raw);
            let amountB = JSBI.multiply(tokenAmountB.raw, TWO);
            amount = new TokenAmount(tokenAmountA.token, JSBI.greaterThan(amountA, amountB) ? amountB : amountA);
        }else{
            let amountA = JSBI.multiply(JSBI.divide(JSBI.multiply(tokenAmountB.raw, TWO), this.pair.reserve0.raw), this.pair.reserve1.raw);
            let amountB = JSBI.multiply(tokenAmountA.raw, TWO);
            amount = new TokenAmount(tokenAmountB.token, JSBI.greaterThan(amountA, amountB) ? amountB : amountA);
        }
        return this.calculatePTU(true, amount, totalSupply, anchorVirtualBalance, gamma);
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


    public getAnchorAsync100LiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh
    ): TokenAmount {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token1), 'TOKEN')

        let halfAmountA = new TokenAmount(tokenAmount.token, JSBI.divide(tokenAmount.raw, TWO));
        let outputAmount = this.pair.getOutputAmount(halfAmountA)

        let liquidity = this.getAnchorAsyncLiquidityMinted(totalSupply, anchorTotalSupply, halfAmountA, outputAmount[0], anchorVirtualBalance)
        if (!JSBI.greaterThan(liquidity.raw, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.anchorLiquidityToken, liquidity.raw)
    }
    public getFloatAsync100LiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        gamma: BigintIsh
    ): TokenAmount {
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token0), 'TOKEN')
        let halfAmountA = new TokenAmount(tokenAmount.token, JSBI.divide(tokenAmount.raw, TWO));
        let outputAmount = this.pair.getOutputAmount(halfAmountA)

        let liquidity = this.getFloatAsyncLiquidityMinted(totalSupply, floatTotalSupply, halfAmountA, outputAmount[0], gamma)
        if (!JSBI.greaterThan(liquidity.raw, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.anchorLiquidityToken, liquidity.raw)
    }

    public getAnchorAsyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
        anchorVirtualBalance: BigintIsh
    ): TokenAmount {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        const tokenAmounts =  [tokenAmountA, tokenAmountB];
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')

        let liquidity = this.getLiquidityFromPoolTokensLiquidity(tokenAmountA, tokenAmountB, totalSupply, true, parseBigintIsh(anchorVirtualBalance))

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
        gamma: BigintIsh
    ): TokenAmount {
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')

        invariant((this.pair.token0.equals(this.token0) && this.pair.token1.equals(this.token1)) ||
            (this.pair.token0.equals(this.token1) && this.pair.token1.equals(this.token0)), 'LIQUIDITY')
        const tokenAmounts =  [tokenAmountA, tokenAmountB];

        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
        let pairTokenAmount: TokenAmount = this.pair.getLiquidityMinted(totalSupply, tokenAmountA, tokenAmountB);
        let liquidity = this.getLiquidityFromPoolTokensLiquidity(tokenAmountA, tokenAmountB, floatTotalSupply, false, undefined, parseBigintIsh(gamma))

        if (!JSBI.greaterThan(pairTokenAmount.raw, ZERO)) {
            throw new InsufficientInputAmountError()
        }

        return new TokenAmount(this.anchorLiquidityToken, liquidity)
    }

    public getAnchorSyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh
    ): TokenAmount {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token1), 'TOKEN')

        let liquidity: JSBI = this.calculatePTU(true, tokenAmount, totalSupply, parseBigintIsh(anchorVirtualBalance));


        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.anchorLiquidityToken, liquidity)
    }

    public getFloatSyncLiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        gamma: BigintIsh,
        pair: Pair
    ): TokenAmount {
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        invariant((pair.token0.equals(this.token0) && pair.token1.equals(this.token1)) || (pair.token0.equals(this.token1) && pair.token1.equals(this.token0)), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token0), 'TOKEN')

        let liquidity: JSBI = this.calculatePTU(true, tokenAmount, totalSupply, undefined, parseBigintIsh(gamma));

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.floatLiquidityToken, liquidity)
    }

    public getLiquidityValue(
        token: Token,
        totalSupply: TokenAmount,
        liquidity: TokenAmount,
        feeOn: boolean = false,
        kLast?: BigintIsh
    ): TokenAmount {
        invariant(this.involvesToken(token), 'TOKEN')
        invariant(totalSupply.token.equals(this.anchorLiquidityToken), 'TOTAL_SUPPLY')
        invariant(liquidity.token.equals(this.anchorLiquidityToken), 'LIQUIDITY')
        invariant(JSBI.lessThanOrEqual(liquidity.raw, totalSupply.raw), 'LIQUIDITY')

        //TODO: calculate this
        let totalSupplyAdjusted: TokenAmount
        if (!feeOn) {
            totalSupplyAdjusted = totalSupply
        } else {
            invariant(!!kLast, 'K_LAST')
            const kLastParsed = parseBigintIsh(kLast)
            if (!JSBI.equal(kLastParsed, ZERO)) {
                const rootK = sqrt(JSBI.multiply(this.reserve0.raw, this.reserve1.raw))
                const rootKLast = sqrt(kLastParsed)
                if (JSBI.greaterThan(rootK, rootKLast)) {
                    const numerator = JSBI.multiply(totalSupply.raw, JSBI.subtract(rootK, rootKLast))
                    const denominator = JSBI.add(JSBI.multiply(rootK, FIVE), rootKLast)
                    const feeLiquidity = JSBI.divide(numerator, denominator)
                    totalSupplyAdjusted = totalSupply.add(new TokenAmount(this.anchorLiquidityToken, feeLiquidity))
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

