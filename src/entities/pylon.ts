import { TokenAmount } from './fractions/tokenAmount'
import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { AbiCoder } from '@ethersproject/abi'
import { pack, keccak256 } from '@ethersproject/solidity'
import { getCreate2Address } from '@ethersproject/address'
import {bytecode as ptBytecode} from '../abis/ZirconPoolToken.json';
import {
    BigintIsh,
    PYLON_CODE_HASH,
    MINIMUM_LIQUIDITY,
    ZERO,
    ONE,
    FIVE,
    _997,
    _1000,
    ChainId, PYLON_FACTORY_ADDRESS, TWO, BASE, PT_FACTORY_ADDRESS, FOUR, TEN, _100, _10000, DOUBLE_BASE
} from '../constants'
import { sqrt, parseBigintIsh } from '../utils'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import { Token } from './token'
import {Pair} from "../entities";
import {PylonFactory} from "entities/pylonFactory";

// let PYLON_ADDRESS_CACHE: { [token0Address: string]: { [token1Address: string]: string } } = {}
let PT_ADDRESS_CACHE: { [tokenAddress: string]: { [pylonAddress: string]: string } } = {}

export class Pylon {
    public readonly floatLiquidityToken: Token
    public readonly anchorLiquidityToken: Token
    public pair: Pair
    private readonly tokenAmounts: [TokenAmount, TokenAmount]
    public readonly address: string

    public static getAddress(tokenA: Token, tokenB: Token): string {
        const pairAddress: string = Pair.getAddress(tokenA, tokenB);
        return getCreate2Address(
            PYLON_FACTORY_ADDRESS[tokenA.chainId],
            keccak256(['bytes'], [pack(['address', 'address', 'address'], [tokenA.address, tokenB.address, pairAddress])]),
            PYLON_CODE_HASH
        )
    }
    public static ptCodeHash = (token: Token): string => keccak256(["bytes"], [pack(['bytes', 'bytes'], [ptBytecode,  new AbiCoder().encode(["address"], [PYLON_FACTORY_ADDRESS[token.chainId]]) ])])
    private static getPTAddress(token: Token, pylonAddress: string): string {
        if (PT_ADDRESS_CACHE?.[token.address]?.[pylonAddress] === undefined) {
            PT_ADDRESS_CACHE = {
                ...PT_ADDRESS_CACHE,
                [token.address]: {
                    ...PT_ADDRESS_CACHE?.[token.address],
                    [pylonAddress]: getCreate2Address(
                        PT_FACTORY_ADDRESS[token.chainId],
                        keccak256(["bytes"], [pack(['address', 'address'], [token.address, pylonAddress])]),
                        Pylon.ptCodeHash(token)
                    )
                }
            }
        }

        return PT_ADDRESS_CACHE[token.address][pylonAddress]
    }
    public static getLiquidityAddresses(tokenA: Token, tokenB: Token): [string, string] {
        const pylonAddress = Pylon.getAddress(tokenA, tokenB);

        const floatLiquidityAddress = Pylon.getPTAddress(tokenA, pylonAddress);
        const anchorLiquidityAddress = Pylon.getPTAddress(tokenB, pylonAddress);
        return [floatLiquidityAddress, anchorLiquidityAddress]
    }


    public constructor(pair: Pair, tokenAmount0: TokenAmount, tokenAmount1: TokenAmount) {
        const tokenAmounts = [tokenAmount0, tokenAmount1];
        this.address = Pylon.getAddress(tokenAmounts[0].token, tokenAmounts[1].token);
        this.pair = pair

        const floatLiquidityAddress = Pylon.getPTAddress(tokenAmount0.token, this.address);
        const anchorLiquidityAddress = Pylon.getPTAddress(tokenAmount1.token, this.address);

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



    private translateToPylon(toTranslate: JSBI, ptb: TokenAmount, ptt: TokenAmount) {
        return JSBI.divide(JSBI.multiply(toTranslate, ptb.raw), ptt.raw)
    }

    private updateSync(vabLast: JSBI, ptb: TokenAmount, ptt: TokenAmount, feeValueAnchor: JSBI, muMulDecimals: JSBI): {gamma: JSBI, vab:JSBI} {
        // Calculating Total Pool Value Anchor Prime
        let tpva = this.translateToPylon(JSBI.multiply(TWO, this.getPairReserves()[1].raw), ptb, ptt);
        console.log('tpva', ptb.raw.toString(), ptt.raw.toString(), tpva.toString())
        // Here is the Virtual Anchor Balance
        let multiplier = JSBI.divide(JSBI.multiply(feeValueAnchor, JSBI.subtract(BASE, muMulDecimals)), BASE)
        console.log("multiplier", vabLast.toString(), multiplier.toString())
        let vab = JSBI.add(vabLast, multiplier);

        let gamma: JSBI;
        if (JSBI.lessThan(JSBI.subtract(vab, this.reserve1.raw), JSBI.divide(tpva, TWO))){
            gamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(BASE,JSBI.subtract(vab, this.reserve1.raw)), tpva))
        }else{
            gamma = JSBI.divide(JSBI.multiply(BASE, tpva), JSBI.multiply(JSBI.subtract(vab, this.reserve1.raw), FOUR))
        }
        console.log("gamma, vab", gamma.toString(), vab.toString())
        return {gamma, vab};
    }

    private changePairReserveonFloatSwap(fee: JSBI) {
        let outputAmount = this.pair.getOutputAmount(new TokenAmount(this.token0, fee))

        let reserves = this.getPairReserves()
        let isFloatR0 = this.token0.equals(this.pair.token0)
        let ta0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, fee))
        let ta1 = new TokenAmount(this.token1, JSBI.subtract(reserves[1].raw, outputAmount[0].raw))

        console.log("new reserves: ", ta0.raw.toString(), ta1.raw.toString())
        this.pair = new Pair(isFloatR0 ? ta0 : ta1,isFloatR0 ? ta1 : ta0 )
    }

    // private updateMU(blockNumber: JSBI, muBlockNumber: JSBI, factory: PylonFactory, gamma: JSBI, muOldGamma: JSBI, muMulDecimals: JSBI): JSBI {
    //     const _newBlockHeight = blockNumber;
    //     const _lastBlockHeight = muBlockNumber;
    //     const muUpdatePeriod = factory.muUpdatePeriod;
    //     if (JSBI.greaterThan(JSBI.subtract(_lastBlockHeight, _newBlockHeight), muUpdatePeriod)) {
    //         const deltaGammaIsPositive = JSBI.greaterThanOrEqual(gamma, muOldGamma);
    //         const gammaOver50 = JSBI.greaterThanOrEqual(gamma, JSBI.BigInt(5e17));
    //         if (deltaGammaIsPositive != gammaOver50) {
    //             let absoluteGammaDeviation = ZERO;
    //             if (gammaOver50) {
    //                 absoluteGammaDeviation = JSBI.subtract(gamma, JSBI.BigInt(5e17));
    //             }else{
    //                 absoluteGammaDeviation = JSBI.subtract(JSBI.BigInt(5e17), gamma);
    //             }
    //             if (deltaGammaIsPositive) {
    //                 const deltaMu = JSBI.divide(JSBI.multiply(JSBI.subtract(gamma, muOldGamma), JSBI.multiply(absoluteGammaDeviation, factory.muChangeFactor)), BASE)
    //                 if (JSBI.lessThanOrEqual(JSBI.add(deltaMu, muMulDecimals), BASE)) {
    //                     return JSBI.add(muMulDecimals, deltaMu);
    //                 }
    //             }else{
    //                 const deltaMu = JSBI.divide(JSBI.multiply(JSBI.subtract(muOldGamma, gamma), absoluteGammaDeviation), BASE)
    //
    //                 if (JSBI.lessThanOrEqual(deltaMu, muMulDecimals)) {
    //                     return JSBI.subtract(muMulDecimals, deltaMu);
    //                 }
    //
    //             }
    //         }else{
    //             if (deltaGammaIsPositive) {
    //                 const deltaMu = JSBI.subtract(gamma, muOldGamma);
    //                 if (JSBI.lessThanOrEqual(JSBI.add(muMulDecimals, deltaMu), BASE)) {
    //                     return JSBI.subtract(muMulDecimals, deltaMu);
    //                 }
    //             }else{
    //                 const deltaMu = JSBI.subtract(muOldGamma, gamma);
    //                 if (JSBI.lessThanOrEqual(deltaMu, muMulDecimals)) {
    //                     return JSBI.subtract(muMulDecimals, deltaMu);
    //                 }
    //             }
    //         }
    //     }
    //     return muMulDecimals;
    // }
    private calculateEMA(emaBlockNumber: JSBI, currentBlockNumber: JSBI, strikeBlock: JSBI, gammaEMA: JSBI, EMASamples: JSBI, thisBlockEMA: JSBI, oldGamma: JSBI, gamma: JSBI): JSBI {
        // Calculating Total Pool Value Anchor Prime
        let blockDiff = JSBI.subtract(currentBlockNumber, emaBlockNumber);
        if(JSBI.equal(blockDiff, ZERO)){
            let blockEMA: JSBI;
            if(JSBI.greaterThan(gamma, oldGamma)){
                blockEMA = JSBI.subtract(gamma, oldGamma);
            }else{
                blockEMA = JSBI.subtract(oldGamma, gamma);
            }

            blockEMA  = JSBI.add(thisBlockEMA, blockEMA);
            if (JSBI.greaterThan(gammaEMA, blockEMA)){
                return gammaEMA;
            }else{
                return blockEMA;
            }
        }else{
            let bleed = ZERO;
            if (JSBI.greaterThan(currentBlockNumber, strikeBlock)) {
                bleed = JSBI.divide(blockDiff, TEN)
            }
            let newGammaEMA = JSBI.divide(JSBI.add(JSBI.multiply(gammaEMA, EMASamples), thisBlockEMA), JSBI.add(JSBI.add(EMASamples, ONE), bleed));
            console.log(`newGammaEMA: ${newGammaEMA.toString()}`)
            let blockEMA: JSBI;
            if(JSBI.greaterThan(gamma, oldGamma)){
                blockEMA = JSBI.subtract(gamma, oldGamma);
            }else{
                blockEMA = JSBI.subtract(oldGamma, gamma);
            }
            console.log(`oldGamma: ${oldGamma.toString()}`)
            console.log(`gamma: ${gamma.toString()}`)
            console.log(`blockEMA: ${blockEMA.toString()}`)

            if (JSBI.greaterThan(newGammaEMA, blockEMA)){
                return newGammaEMA;
            }else{
                return blockEMA;
            }
        }
    }


    private calculatePTU(isAnchor: boolean, tokenAmount: JSBI, ptt: TokenAmount, ptb: TokenAmount, ptTotalSupply: TokenAmount, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI{
        invariant(ptTotalSupply.token.equals(this.anchorLiquidityToken) || ptTotalSupply.token.equals(this.floatLiquidityToken), 'NEGATIVE')
        let liquidity: JSBI
        if (isAnchor) {
            if (JSBI.equal(ptTotalSupply.raw, ZERO)) {
                liquidity = JSBI.subtract(tokenAmount, MINIMUM_LIQUIDITY)
            } else {
                liquidity = JSBI.divide(JSBI.multiply(ptTotalSupply.raw, tokenAmount), anchorVirtualBalance!)
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
                liquidity = JSBI.subtract(JSBI.divide(JSBI.multiply(BASE, tokenAmount), denominator), MINIMUM_LIQUIDITY)
            }else {
                liquidity = JSBI.divide(JSBI.multiply(ptTotalSupply.raw, tokenAmount), denominator)
            }
        }

        return liquidity
    }

    private  handleSyncAndAsync(maxSync: JSBI, reserveTranslated: JSBI, reserve: JSBI, amountIn: JSBI) : {sync: JSBI, async: JSBI} {
        let max = JSBI.divide(JSBI.multiply(reserveTranslated, maxSync), _100);
        let freeSpace = ZERO;
        if (JSBI.greaterThan(max, reserve)) {
            freeSpace = JSBI.subtract(max, reserve);
            if(JSBI.greaterThan(freeSpace, amountIn)){
                return {
                    sync: amountIn,
                    async: ZERO
                };
            }
        }
        let amountAsync = JSBI.subtract(amountIn, freeSpace);
        return {
            sync: freeSpace,
            async: amountAsync
        }
    }

    private getFeeByGamma(gamma: JSBI, minFee: JSBI, maxFee: JSBI): JSBI {
        let gammaHalf = JSBI.BigInt(5e17);
        let x: JSBI;
        if(JSBI.greaterThan(gamma, gammaHalf)){
            x = JSBI.multiply(JSBI.subtract(gamma, gammaHalf), TEN);
        }else{
            x = JSBI.multiply(JSBI.subtract(gammaHalf, gamma), TEN);
        }

        let minThreshold = JSBI.BigInt(45e16);
        let maxThreshold = JSBI.BigInt(55e16);
        if(JSBI.lessThanOrEqual(gamma, minThreshold) || JSBI.greaterThanOrEqual(gamma, maxThreshold)){
            console.log("1")
            return JSBI.divide(JSBI.multiply(JSBI.multiply(maxFee, x), x), JSBI.BigInt(25e36));
        }else{
            console.log("2")
            return JSBI.add(JSBI.divide(JSBI.multiply(JSBI.multiply(JSBI.multiply(minFee, x), x), JSBI.BigInt(36)), DOUBLE_BASE), minFee);
        }
    }

    private applyDeltaAndGammaTax(amount: JSBI, strikeBlock: JSBI, blockNumber: JSBI, gamma: JSBI, pylonFactory: PylonFactory, maxDerivative: JSBI):
        {newAmount: JSBI, fee: JSBI, deltaApplied: boolean, blocked: boolean} {
        let getFeeByGamma = this.getFeeByGamma(gamma, pylonFactory.minFee, pylonFactory.maxFee);

        if(JSBI.greaterThanOrEqual(maxDerivative, pylonFactory.deltaGammaThreshold)){
            console.log("2")
            let strikeDiff = JSBI.subtract(blockNumber, strikeBlock);
            let cooldownBlocks = JSBI.divide(BASE, pylonFactory.deltaGammaThreshold);
            if  (JSBI.lessThanOrEqual(strikeDiff, cooldownBlocks)) {
                let feeBPS = JSBI.add(JSBI.add(JSBI.subtract(JSBI.divide(JSBI.multiply(maxDerivative, _10000), pylonFactory.deltaGammaThreshold), _10000), pylonFactory.deltaGammaFee), getFeeByGamma);
                if (JSBI.greaterThan(feeBPS, _10000)) {
                    return {
                        newAmount: ZERO,
                        fee: ZERO,
                        deltaApplied: false,
                        blocked: true
                    }
                }else{
                    let fee = JSBI.divide(JSBI.multiply(feeBPS, amount), _10000);
                    return {
                        newAmount: JSBI.subtract(amount, fee),
                        fee,
                        deltaApplied: true,
                        blocked: false
                    }
                }
            }
        }

        let fee = JSBI.divide(JSBI.multiply(getFeeByGamma, amount), _10000);
        console.log("1", fee.toString());
        return {newAmount: JSBI.subtract(amount, fee), fee, deltaApplied: false, blocked: false}
    }



    private getLiquidityFromPoolTokensLiquidity(tokenAmountA: JSBI, tokenAmountB: JSBI, totalSupply: TokenAmount, ptb: TokenAmount, ptTotalSupply: TokenAmount,
                                                isAnchor: boolean, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI {
        let amount: JSBI;
        if (isAnchor){
            let amountA = JSBI.divide(JSBI.multiply(this.getPairReserves()[1].raw, JSBI.multiply(tokenAmountA, TWO)), this.getPairReserves()[0].raw);
            let amountB = JSBI.multiply(tokenAmountB, TWO);
            amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA;
        }else{
            // changing values on reserves because fees are swapped only on float changing the reserve
            // just for precision purposes
            let amountA = JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, JSBI.multiply(tokenAmountB, TWO)), this.getPairReserves()[1].raw);
            let amountB = JSBI.multiply(tokenAmountA, TWO);
            amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA;
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
//
//     uint balance0 = IUniswapV2ERC20(pylonToken.float).balanceOf(address(this));
//     uint balance1 = IUniswapV2ERC20(pylonToken.anchor).balanceOf(address(this));
//     notZero(balance0);
//     notZero(balance1);
//
//     // Let's get the balances so we can see what the user send us
//     // As we are initializing the reserves are going to be null
//     // Let's see if the pair contains some reserves
// (uint112 _reservePair0, uint112 _reservePair1) = getPairReservesNormalized();
//     //        lastPoolTokens = IZirconPair(pairAddress).totalSupply();
//     //        lastK = _reservePair0.mul(_reservePair1);
//     // If pair contains reserves we have to use the ratio of the Pair so...
//     virtualAnchorBalance = balance1;
//
//     if (_reservePair0 > 0 && _reservePair1 > 0) {
//     uint tpvAnchorPrime = (virtualAnchorBalance.add(balance0.mul(_reservePair1)/_reservePair0));
//
//     if (virtualAnchorBalance < tpvAnchorPrime/2) {
//     gammaMulDecimals = 1e18 - (virtualAnchorBalance.mul(1e18)/(tpvAnchorPrime));
// } else {
//     gammaMulDecimals = tpvAnchorPrime.mul(1e18)/(virtualAnchorBalance.mul(4)); // Subflow already checked by if statement
// }
// // This is gamma formula when FTV <= 50%
// } else {
//     // When Pair is not initialized let's start gamma to 0.5
//     gammaMulDecimals = 500000000000000000;
// }
//
// // Time to mint some tokens
// (anchorLiquidity) = _calculateSyncLiquidity(balance1, 0, _reservePair1, anchorPoolTokenAddress, true);
// (floatLiquidity) = _calculateSyncLiquidity(balance0, 0, _reservePair0, floatPoolTokenAddress, false);

public initializeValues(
        totalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
    ): [JSBI, JSBI] {
        let balance0 = tokenAmountA.raw;
        let vab = tokenAmountB.raw
        let gamma;

        if(JSBI.equal(this.getPairReserves()[1].raw, ZERO)) {
            gamma = JSBI.BigInt("500000000000000000");
        }else{
            let tpva = JSBI.add(vab, JSBI.multiply(balance0, JSBI.divide(this.getPairReserves()[1].raw, this.getPairReserves()[0].raw)))
            if (JSBI.lessThan(vab, JSBI.divide(tpva, TWO))) {
                gamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(vab, JSBI.multiply(vab, BASE)), tpva))
            }else{
                gamma = JSBI.divide(JSBI.multiply(tpva, BASE), JSBI.multiply(vab, FOUR))
            }
        }

        let liquidityFloat: JSBI = this.calculatePTU(false,  tokenAmountA.raw, totalSupply, new TokenAmount(tokenAmountA.token, ZERO), new TokenAmount(this.floatLiquidityToken, ZERO), vab, gamma);
        let liquidityAnchor: JSBI = this.calculatePTU(true,  tokenAmountB.raw, totalSupply, new TokenAmount(tokenAmountA.token, ZERO), new TokenAmount(this.anchorLiquidityToken, ZERO), vab, gamma);
        return [liquidityFloat, liquidityAnchor];
    }

    public getOneSideLiquidity(reserve: JSBI, otherReserve: JSBI, otherBalance: JSBI, amount: JSBI, factory: PylonFactory, totalSupply: JSBI): JSBI{
        let fee = JSBI.divide(factory.liquidityFee, TWO)
        let k = sqrt(JSBI.multiply(otherBalance, JSBI.add(reserve, JSBI.divide(JSBI.multiply(amount, JSBI.subtract(_10000, JSBI.add(fee, ONE))), _10000))));
        let kBefore = sqrt(JSBI.multiply(reserve, otherReserve))
        return JSBI.divide(JSBI.multiply(totalSupply, JSBI.subtract(k, kBefore)), kBefore)
    }

    public getAnchorAsync100LiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        feeValueAnchor: BigintIsh,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token1), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
        let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        if (fee.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }
        let halfAmountA = new TokenAmount(this.token1, JSBI.divide(fee.newAmount, TWO));
        let outputAmount = this.pair.getOutputAmount(halfAmountA);
        let liquidity = this.getLiquidityFromPoolTokensLiquidity(outputAmount[0].raw, halfAmountA.raw, totalSupply, ptb, anchorTotalSupply, true, result.vab)

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied}
    }
    public getFloatAsync100LiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        feeValueAnchor: BigintIsh,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token0), 'TOKEN')

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
        let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        this.changePairReserveonFloatSwap(fee.fee)
        if (fee.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }

        let halfAmountA = new TokenAmount(this.token0, JSBI.divide(fee.newAmount, TWO));
        let outputAmount = this.pair.getOutputAmount(halfAmountA)

        let liquidity = this.getLiquidityFromPoolTokensLiquidity(halfAmountA.raw, outputAmount[0].raw, totalSupply, ptb, floatTotalSupply, false, result.vab, result.gamma)

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied}
    }

    public getAnchorAsyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        feeValueAnchor: BigintIsh,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        const tokenAmounts = [tokenAmountA, tokenAmountB];
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))


        let fee1 = this.applyDeltaAndGammaTax(tokenAmountA.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        let fee2 = this.applyDeltaAndGammaTax(tokenAmountB.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        if (fee1.blocked || fee2.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }
        let liquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.newAmount, fee2.newAmount, totalSupply, ptb, anchorTotalSupply, true, result.vab)

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
            deltaApplied: fee1.deltaApplied || fee2.deltaApplied}
    }



    public getFloatAsyncLiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        feeValueAnchor: BigintIsh,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        // invariant((this.pair.token0.equals(this.token0) && this.pair.token1.equals(this.token1)) ||
        //     (this.pair.token0.equals(this.token1) && this.pair.token1.equals(this.token0)), 'LIQUIDITY')
        const tokenAmounts =  [tokenAmountA, tokenAmountB];
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))

        let fee1 = this.applyDeltaAndGammaTax(tokenAmountA.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        let fee2 = this.applyDeltaAndGammaTax(tokenAmountB.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        this.changePairReserveonFloatSwap(fee1.fee)
        if (fee1.blocked || fee2.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }

        let liquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.newAmount, fee2.newAmount, totalSupply, ptb, floatTotalSupply, false, result.vab, result.gamma)
        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }

        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
            deltaApplied: fee1.deltaApplied || fee2.deltaApplied}

    }

    public getAnchorSyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        feeValueAnchor: BigintIsh,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token1), 'TOKEN')
        console.log(anchorTotalSupply.token.equals(this.anchorLiquidityToken));
        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), parseBigintIsh(factory.EMASamples), parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
        let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        if (fee.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }

        let pairReserveTranslated = this.translateToPylon(this.pair!.reserve1.raw, ptb, totalSupply);
        let amountsToInvest = this.handleSyncAndAsync(factory.maxSync, pairReserveTranslated, this.reserve1.raw, fee.newAmount)
        let syncLiquidity = ZERO
        if (JSBI.greaterThan(amountsToInvest.sync, ZERO)) {
            syncLiquidity = this.calculatePTU(true, amountsToInvest.sync, totalSupply, ptb, anchorTotalSupply, result.vab);
        }
        let asyncLiquidity: JSBI = ZERO;
        if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
            let halfAmountA = new TokenAmount(this.token1, JSBI.divide(amountsToInvest.async, TWO));
            let outputAmount = this.pair.getOutputAmount(halfAmountA)
            asyncLiquidity = this.getLiquidityFromPoolTokensLiquidity(outputAmount[0].raw, halfAmountA.raw,totalSupply, ptb, anchorTotalSupply, true, result.vab, result.gamma)
        }


        let liquidity: JSBI = JSBI.add(syncLiquidity, asyncLiquidity);
        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied}
    }


    public getFloatSyncLiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        feeValueAnchor: BigintIsh,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        //invariant((pair.token0.equals(this.token0) && pair.token1.equals(this.token1)) || (pair.token0.equals(this.token1) && pair.token1.equals(this.token0)), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token0), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
        console.log("gamma and vab: ", result.gamma.toString(), result.vab.toString())

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
        let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        this.changePairReserveonFloatSwap(fee.fee)
        if (fee.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }
        let pairReserveTranslated = this.translateToPylon(this.pair!.reserve0.raw, ptb, totalSupply);
        let amountsToInvest = this.handleSyncAndAsync(factory.maxSync, pairReserveTranslated, this.reserve0.raw, fee.newAmount)
        console.log("sync and async: ", amountsToInvest.sync.toString(), amountsToInvest.async.toString())
        let syncLiquidity: JSBI = ZERO
        if (JSBI.greaterThan(amountsToInvest.sync, ZERO)) {
            console.log("sync liquidity", amountsToInvest.sync.toString())

            syncLiquidity = this.calculatePTU(false, amountsToInvest.sync, totalSupply, ptb, floatTotalSupply, result.vab, result.gamma);
        }
        let asyncLiquidity: JSBI = ZERO;
        if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
            let halfAmountA = new TokenAmount(this.token0, JSBI.divide(amountsToInvest.async, TWO));
            let outputAmount = this.pair.getOutputAmount(halfAmountA)
            asyncLiquidity = this.getLiquidityFromPoolTokensLiquidity(halfAmountA.raw, outputAmount[0].raw, totalSupply, ptb, floatTotalSupply, false, result.vab, result.gamma)
        }

        let liquidity = JSBI.add(syncLiquidity, asyncLiquidity);
        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }

        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied}

    }



    // public burnFloat(
    //     totalSupply: TokenAmount,
    //     floatTotalSupply: TokenAmount,
    //     tokenAmountOut: TokenAmount,
    //     anchorVirtualBalance: BigintIsh,
    //     muMulDecimals: BigintIsh,
    //     gammaLast: BigintIsh,
    //     kLast: BigintIsh,
    //     ptb: TokenAmount,
    //     feeValueAnchor: BigintIsh,
    // ): TokenAmount {
    //     let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
    //
    //     let reservesPTU = this.calculatePTU(false, this.reserve0, totalSupply, ptb, floatTotalSupply, result.vab, result.gamma);
    //     let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU;
    //
    //     let amount = this.calculatePTUToAmount(
    //         totalSupply,
    //         floatTotalSupply,
    //         new TokenAmount(tokenAmountOut.token, minAmount),
    //         result.vab,
    //         result.gamma,
    //         ptb.raw,
    //         false
    //     )
    //     if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {
    //         let adjustedLiq = JSBI.subtract(tokenAmountOut.raw, reservesPTU);
    //         // console.log("adjustedLiq", adjustedLiq.toString(10))
    //         let lptu = this.calculateLPTU(totalSupply, floatTotalSupply, adjustedLiq, result.vab, result.gamma, ptb, false);
    //         // console.log("lptu", lptu.toString(10))
    //
    //         //604705541361411447
    //         let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
    //         let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);
    //         let newPair = new Pair(new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
    //             new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)));
    //
    //         let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token1, amount1));
    //         // console.log("amount", amount.toString(10))
    //
    //         amount = JSBI.add(amount, JSBI.add(amount0, amountTransformed[0].raw));
    //         // console.log("amount", amount.toString(10))
    //
    //     }
    //     return  new TokenAmount(tokenAmountOut.token, amount);
    // }
    // public burnAnchor(
    //     totalSupply: TokenAmount,
    //     anchorTotalSupply: TokenAmount,
    //     tokenAmountOut: TokenAmount,
    //     anchorVirtualBalance: BigintIsh,
    //     muMulDecimals: BigintIsh,
    //     gammaLast: BigintIsh,
    //     kLast: BigintIsh,
    //     ptb: TokenAmount,
    //     feeValueAnchor: BigintIsh,
    // ): TokenAmount {
    //     let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
    //
    //     let reservesPTU = this.calculatePTU(true, this.reserve1, totalSupply, ptb, anchorTotalSupply, result.vab, result.gamma);
    //     let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU;
    //     let amount = this.calculatePTUToAmount(
    //         totalSupply,
    //         anchorTotalSupply,
    //         new TokenAmount(tokenAmountOut.token, minAmount),
    //         result.vab,
    //         result.gamma,
    //         ptb.raw,
    //         true
    //     )
    //     // console.log("reservesPTU", reservesPTU.toString(10), tokenAmountOut.raw.toString(10))
    //
    //     if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {
    //         // console.log("here")
    //         let omega = this.getOmegaSlashing(result.gamma, result.vab, ptb, totalSupply);
    //         console.log("omega", omega.toString(10))
    //
    //         let adjustedLiq = JSBI.divide(JSBI.multiply(omega, JSBI.subtract(tokenAmountOut.raw, reservesPTU)), BASE);
    //         let lptu = this.calculateLPTU(totalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, ptb, true);
    //         // console.log("lptu", lptu.toString(10))
    //
    //         let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
    //         let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);
    //         // console.log(amount0.toString(10), amount1.toString(10))
    //         let newPair = new Pair(new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
    //             new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)));
    //
    //         let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token0, amount0));
    //         // console.log("amount", amount.toString(10))
    //
    //         amount = JSBI.add(amount, JSBI.add(amount1, amountTransformed[0].raw));
    //         // console.log("amount", amount.toString(10))
    //
    //     }
    //     return new TokenAmount(tokenAmountOut.token, amount);
    // }
    //
    // public burnAsyncAnchor(
    //     totalSupply: TokenAmount,
    //     anchorTotalSupply: TokenAmount,
    //     tokenAmountOut: TokenAmount,
    //     anchorVirtualBalance: BigintIsh,
    //     muMulDecimals: BigintIsh,
    //     gammaLast: BigintIsh,
    //     kLast: BigintIsh,
    //     ptb: TokenAmount,
    //     feeValueAnchor: BigintIsh,
    // ): [TokenAmount, TokenAmount] {
    //     let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
    //
    //     let omega = this.getOmegaSlashing(result.gamma, result.vab, ptb, totalSupply);
    //     console.log("omega", omega.toString(10))
    //     let adjustedLiq = JSBI.divide(JSBI.multiply(omega, tokenAmountOut.raw), BASE)
    //     let lptu = this.calculateLPTU(totalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, ptb, true);
    //     let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
    //     let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);
    //
    //     return [new TokenAmount(this.token0, amount0), new TokenAmount(this.token1, amount1)];
    // }
    //
    // public burnAsyncFloat(
    //     totalSupply: TokenAmount,
    //     floatTotalSupply: TokenAmount,
    //     tokenAmountOut: TokenAmount,
    //     anchorVirtualBalance: BigintIsh,
    //     muMulDecimals: BigintIsh,
    //     gammaLast: BigintIsh,
    //     kLast: BigintIsh,
    //     ptb: TokenAmount,
    //     feeValueAnchor: BigintIsh,
    // ): [TokenAmount, TokenAmount] {
    //     let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
    //
    //
    //
    //     let lptu = this.calculateLPTU(totalSupply, floatTotalSupply, tokenAmountOut.raw, result.vab, result.gamma, ptb, false);
    //     let amount0 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[0].raw), totalSupply.raw);
    //     let amount1 = JSBI.divide(JSBI.multiply(lptu, this.getPairReserves()[1].raw), totalSupply.raw);
    //
    //
    //     return [new TokenAmount(this.token0, amount0), new TokenAmount(this.token1, amount1)];
    // }

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

