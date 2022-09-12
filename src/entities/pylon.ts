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
    _997,
    _1000,
    ChainId,
    PYLON_FACTORY_ADDRESS,
    TWO,
    BASE,
    PT_FACTORY_ADDRESS,
    FOUR,
    TEN,
    _100,
    _10000,
    DOUBLE_BASE, EN_FACTORY_ADDRESS, EN_CODE_HASH,
} from '../constants'
import { sqrt, parseBigintIsh } from '../utils'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import { Token } from './token'
import {Pair} from "../entities";
import {PylonFactory} from "entities/pylonFactory";

let PYLON_ADDRESS_CACHE: {[pair: string] : {[tokenAddress: string]: string}} = {}
let PT_ADDRESS_CACHE: { [tokenAddress: string]: { [pylonAddress: string]: string } } = {}
let ENERGY_ADDRESS_CACHE: { [tokenAddress: string]: { [pairAddress: string]: string } } = {}

export class Pylon {
    public readonly floatLiquidityToken: Token
    public readonly anchorLiquidityToken: Token
    public pair: Pair
    private readonly tokenAmounts: [TokenAmount, TokenAmount]
    public readonly address: string

    public static getAddress(tokenA: Token, tokenB: Token): string {
        const pairAddress: string = Pair.getAddress(tokenA, tokenB);
        if (PYLON_ADDRESS_CACHE?.[pairAddress]?.[tokenA.address] === undefined) {
            PYLON_ADDRESS_CACHE = {
                ...PYLON_ADDRESS_CACHE,
                [pairAddress]: {
                    ...PYLON_ADDRESS_CACHE?.[pairAddress],
                    [tokenA.address]: getCreate2Address(
                        PYLON_FACTORY_ADDRESS[tokenA.chainId],
                        keccak256(['bytes'], [pack(['address', 'address', 'address'], [tokenA.address, tokenB.address, pairAddress])]),
                        PYLON_CODE_HASH
                    )
                }
            }
        }
        return PYLON_ADDRESS_CACHE[pairAddress][tokenA.address]
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

    public static getEnergyAddress(tokenA: Token, tokenB: Token): string|undefined {
        if (tokenA && tokenB) {
            let pairAddress = Pair.getAddress(tokenA, tokenB);
            if (ENERGY_ADDRESS_CACHE?.[tokenA.address]?.[Pair.getAddress(tokenA, tokenB)] === undefined) {
                ENERGY_ADDRESS_CACHE = {
                    ...ENERGY_ADDRESS_CACHE,
                    [tokenA.address]: {
                        ...ENERGY_ADDRESS_CACHE?.[tokenA.address],
                        [pairAddress]: getCreate2Address(
                            EN_FACTORY_ADDRESS[tokenA.chainId],
                            keccak256(["bytes"], [pack(['address', 'address'], [pairAddress, tokenA.address])]),
                            EN_CODE_HASH
                        )
                    }
                }
            }
            return ENERGY_ADDRESS_CACHE[tokenA.address][pairAddress]
        }else {
            return undefined
        }

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

    public getHealthFactor( vab: BigintIsh, ptb: TokenAmount, ptt: TokenAmount, reserveAnchorEnergy: BigintIsh, ptbEnergy: BigintIsh, isLineFormula: boolean,
                           muMulDecimals: BigintIsh, lastRootK: BigintIsh, anchorKFactor: BigintIsh, kLast: BigintIsh, factory: PylonFactory): String {

        // High -> Omega >= 1 && Price >= breakevenPrice
        //
        // Medium -> Omega >= .95 && anchorReserve + poolTokenReserve > (1-Omega) * TPV
        //
        // Low -> Omega <= .95 || anchorReserve + poolTokenReserve < (1-Omega) * TPV

        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), ptt.raw, factory)
        let newTotalSupply = JSBI.add(ptt.raw, ptMinted);
        let result = this.updateSync(parseBigintIsh(vab), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let resTR1 = this.translateToPylon(this.getPairReserves()[1].raw, ptb.raw, ptt.raw);
        let percentageAnchorEnergy = JSBI.divide(JSBI.multiply(parseBigintIsh(reserveAnchorEnergy), BASE), result.vab);

        let percentagePTBEnergy = JSBI.divide(JSBI.multiply(parseBigintIsh(ptbEnergy), JSBI.divide(JSBI.multiply(result.vab, BASE), resTR1)), BASE);
        let omega = this.getOmegaSlashing(result.gamma, result.vab, ptb.raw, ptt.raw, BASE)
        if (JSBI.greaterThanOrEqual(omega, BASE) && !isLineFormula) {
            return "high"
        }else if (JSBI.greaterThanOrEqual(omega, JSBI.subtract(BASE, JSBI.BigInt(5000000000000000))) &&
        JSBI.greaterThanOrEqual(JSBI.add(percentageAnchorEnergy, percentagePTBEnergy), JSBI.subtract(BASE, omega))) {
            return "medium"
        }else {
            return "low"
        }
    }

    private translateToPylon(toTranslate: JSBI, ptb: JSBI, ptt: JSBI) {
        return JSBI.divide(JSBI.multiply(toTranslate, ptb), ptt)
    }

    private updateSync(vabLast: JSBI, lastRootK: JSBI, anchorKFactor: JSBI, isLineFormula: boolean, ptb: JSBI, ptt: JSBI, muMulDecimals: JSBI): {gamma: JSBI, vab:JSBI} {
        // Calculating Total Pool Value Anchor Prime
        let resTR0 = this.translateToPylon( this.getPairReserves()[0].raw, ptb, ptt);
        let resTR1 = this.translateToPylon( this.getPairReserves()[1].raw, ptb, ptt);

        let rootK = sqrt(JSBI.multiply(resTR0, resTR1))
        let feeValuePercentageAnchor = JSBI.divide(JSBI.multiply(JSBI.subtract(rootK, lastRootK), muMulDecimals), lastRootK)
        let anchorK = ZERO;
        if(JSBI.notEqual(feeValuePercentageAnchor, ZERO)) {
            let feeToAnchor = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, resTR1), feeValuePercentageAnchor), BASE)
            let adjVAB = JSBI.subtract(vabLast, this.reserve1.raw)

            anchorK = this.calculateAnchorFactor(
                isLineFormula,
                JSBI.divide(JSBI.multiply(feeToAnchor, adjVAB), vabLast),
                anchorKFactor,
                JSBI.subtract(vabLast, this.reserve1.raw),
                JSBI.divide(JSBI.multiply(resTR0, JSBI.subtract(BASE, feeValuePercentageAnchor)), BASE),
                JSBI.divide(JSBI.multiply(resTR1, JSBI.subtract(BASE, feeValuePercentageAnchor)), BASE) )


            vabLast = JSBI.add(vabLast, feeToAnchor)
        }
        let adjVAB = JSBI.subtract(vabLast, this.reserve1.raw)
        let tpva = JSBI.multiply(resTR1, TWO)

        let sqrtKFactor = sqrt(JSBI.multiply(JSBI.subtract(JSBI.divide(JSBI.exponentiate(anchorKFactor, TWO), BASE), anchorKFactor), BASE))

        let vabMultiplier = JSBI.lessThan(sqrtKFactor, anchorK) ?
            JSBI.subtract(anchorK, sqrtKFactor) :
            JSBI.add(anchorK, sqrtKFactor)

        let reserveSwitch = JSBI.divide(JSBI.multiply(adjVAB, vabMultiplier), BASE)
        let gamma: JSBI;
        if (JSBI.greaterThan(resTR1, reserveSwitch)) {
            gamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(adjVAB, BASE), tpva))
        }else{
            gamma = JSBI.divide(JSBI.multiply(BASE, tpva), JSBI.multiply(FOUR, adjVAB))
            gamma = JSBI.divide(JSBI.multiply(gamma, BASE), anchorKFactor)
        }
        return {gamma, vab: vabLast};
    }

    private changePairReserveonFloatSwap(fee: JSBI) {
        if (JSBI.greaterThan(fee, ZERO)) {
            let outputAmount = this.pair.getOutputAmount(new TokenAmount(this.token0, fee))

            let reserves = this.getPairReserves()
            let isFloatR0 = this.token0.equals(this.pair.token0)
            let ta0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, fee))
            let ta1 = new TokenAmount(this.token1, JSBI.subtract(reserves[1].raw, outputAmount[0].raw))

            this.pair = new Pair(isFloatR0 ? ta0 : ta1, isFloatR0 ? ta1 : ta0)
        }
    }

    private calculatePTUToAmount(
        totalSupply: JSBI,
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
            return JSBI.divide(JSBI.multiply(JSBI.add(JSBI.divide(JSBI.multiply(JSBI.multiply(JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, ptb), totalSupply), gamma), TWO), BASE), this.reserve0.raw), tokenAmount.raw), floatTotalSupply.raw)
        }
    }

    private calculateAnchorFactor(
        isLineFormula: boolean,
        amount: JSBI,
        oldKFactor: JSBI,
        adjVAB: JSBI,
        resTR0: JSBI,
        resTR1: JSBI
    ): JSBI {
        let sqrtKFactor = sqrt(JSBI.multiply(JSBI.subtract(JSBI.divide(JSBI.exponentiate(oldKFactor, TWO), BASE), oldKFactor), BASE));
        let vabFactor = JSBI.lessThan(sqrtKFactor, oldKFactor) ? JSBI.subtract(oldKFactor, sqrtKFactor) : JSBI.add(oldKFactor, sqrtKFactor)
        let amountTres = JSBI.divide(JSBI.multiply(resTR1, DOUBLE_BASE), JSBI.multiply(adjVAB, vabFactor))

        if (isLineFormula || JSBI.greaterThanOrEqual(amountTres, BASE)) {
            if (!isLineFormula && JSBI.lessThan(JSBI.add(BASE, JSBI.divide(JSBI.multiply(amount, BASE), adjVAB)), amountTres)) {
                return oldKFactor
            }
            let kFormFalse = JSBI.multiply(JSBI.add(resTR0, JSBI.multiply(JSBI.divide(JSBI.multiply(JSBI.subtract(amountTres, BASE), adjVAB), TWO), JSBI.divide(resTR0, resTR1))),
            JSBI.add(resTR1, JSBI.divide(JSBI.multiply(JSBI.subtract(amountTres, BASE), adjVAB), TWO)))

            let initialK = isLineFormula ? JSBI.multiply(resTR1, resTR0) : kFormFalse

            let initialVAB = isLineFormula ? adjVAB : JSBI.divide(JSBI.multiply(amountTres, adjVAB), BASE)

            let kPrime = JSBI.add(JSBI.add(resTR0, JSBI.divide(JSBI.multiply(amount, resTR0), JSBI.multiply(TWO, resTR1) )), JSBI.multiply(resTR1, JSBI.divide(resTR1, TWO)))

            let anchorKFac = JSBI.divide(JSBI.multiply(kPrime, initialVAB), initialK)
            anchorKFac = JSBI.divide(JSBI.multiply(anchorKFac, oldKFactor), JSBI.add(adjVAB, amount))

            return JSBI.lessThan(anchorKFac, BASE) ? BASE : anchorKFac

        }else{
            return oldKFactor
        }
    }


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
            let blockEMA: JSBI;
            if(JSBI.greaterThan(gamma, oldGamma)){
                blockEMA = JSBI.subtract(gamma, oldGamma);
            }else{
                blockEMA = JSBI.subtract(oldGamma, gamma);
            }

            if (JSBI.greaterThan(newGammaEMA, blockEMA)){
                return newGammaEMA;
            }else{
                return blockEMA;
            }
        }
    }


    private calculatePTU(isAnchor: boolean, tokenAmount: JSBI, ptt: JSBI, ptb: JSBI, ptTotalSupply: TokenAmount, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI{
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

    private handleSyncAndAsync(maxSync: JSBI, reserveTranslated: JSBI, reserve: JSBI, amountIn: JSBI) : {sync: JSBI, async: JSBI} {
        // 40391590611806077323
        // 40398719672615852819
        console.log("rt", reserveTranslated.toString())
        let max = JSBI.divide(JSBI.multiply(reserveTranslated, maxSync), _100);
        let freeSpace = ZERO;
        if (JSBI.greaterThan(max, reserve)) {
            // 4039159061180607732 2650000000000000000
            // 4039871967261585400 2650000000000000000
            console.log('max', JSBI.toNumber(max), "reserve", JSBI.toNumber(reserve))
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
            return JSBI.divide(JSBI.multiply(JSBI.multiply(maxFee, x), x), JSBI.BigInt(25e36));
        }else{
            return JSBI.add(JSBI.divide(JSBI.multiply(JSBI.multiply(JSBI.multiply(minFee, x), x), JSBI.BigInt(36)), DOUBLE_BASE), minFee);
        }
    }

    private applyDeltaAndGammaTax(amount: JSBI, strikeBlock: JSBI, blockNumber: JSBI, gamma: JSBI, pylonFactory: PylonFactory, maxDerivative: JSBI):
        {newAmount: JSBI, fee: JSBI, deltaApplied: boolean, blocked: boolean, asyncBlocked: boolean} {
        let getFeeByGamma = this.getFeeByGamma(gamma, pylonFactory.minFee, pylonFactory.maxFee);

        if(JSBI.greaterThanOrEqual(maxDerivative, pylonFactory.deltaGammaThreshold)){
            let strikeDiff = JSBI.subtract(blockNumber, strikeBlock);
            let cooldownBlocks = JSBI.divide(BASE, pylonFactory.deltaGammaThreshold);

            if  (JSBI.lessThanOrEqual(strikeDiff, cooldownBlocks)) {
                let feeBPS = JSBI.add(JSBI.add(JSBI.subtract(JSBI.divide(JSBI.multiply(maxDerivative, _10000), pylonFactory.deltaGammaThreshold), _10000), pylonFactory.deltaGammaFee), getFeeByGamma);
                if (JSBI.greaterThan(feeBPS, _10000)) {
                    return {
                        newAmount: ZERO,
                        fee: ZERO,
                        deltaApplied: false,
                        blocked: true,
                        asyncBlocked: false
                    }
                }else{
                    let fee = JSBI.divide(JSBI.multiply(feeBPS, amount), _10000);
                    return {
                        newAmount: JSBI.subtract(amount, fee),
                        fee,
                        deltaApplied: true,
                        blocked: false,
                        asyncBlocked: false
                    }
                }
            }else{
                let fee = JSBI.divide(JSBI.multiply(getFeeByGamma, amount), _10000);
                return {newAmount: JSBI.subtract(amount, fee), fee, deltaApplied: false, blocked: false, asyncBlocked: true}
            }
        }

        let fee = JSBI.divide(JSBI.multiply(getFeeByGamma, amount), _10000);
        return {newAmount: JSBI.subtract(amount, fee), fee, deltaApplied: false, blocked: false, asyncBlocked: false}
    }
    // maxPoolTK 432954696874568352
    // lptu 145470410107651158
    // maxPoolTokens 432954688701824863
    // lptu 145470412853648321


    // 21590909090909090
    // 21590909090909090
    private calculateLPTU(
        totalSupply: JSBI,
        ptTotalSupply: TokenAmount,
        tokenAmount: JSBI,
        anchorVirtualBalance: JSBI,
        gamma: JSBI,
        ptb: JSBI,
        isAnchor: boolean): JSBI {

        let pylonShare: JSBI;
        let maxPoolTK: JSBI;
        let ptTR0 =  this.translateToPylon(this.getPairReserves()[0].raw, ptb, totalSupply)
        let ptTR1 =  this.translateToPylon(this.getPairReserves()[1].raw, ptb, totalSupply)
        if(isAnchor) {
            pylonShare = JSBI.divide(JSBI.multiply(ptb, JSBI.subtract(anchorVirtualBalance, this.reserve1.raw)), JSBI.multiply(TWO, ptTR1));
            maxPoolTK = JSBI.subtract(ptTotalSupply.raw, JSBI.divide(JSBI.multiply(ptTotalSupply.raw, this.reserve1.raw), anchorVirtualBalance));
            // pylonShare = JSBI.add(pylonShare, JSBI.divide(JSBI.multiply(pylonShare, this.reserve1.raw), JSBI.multiply(ptTR1, TWO) ))
        }else{
            pylonShare = JSBI.divide(JSBI.multiply(gamma, ptb), BASE)
            maxPoolTK = JSBI.subtract(ptTotalSupply.raw, JSBI.divide(JSBI.multiply(ptTotalSupply.raw, this.reserve0.raw), JSBI.add(JSBI.divide(JSBI.multiply(JSBI.multiply(ptTR0, TWO), gamma), BASE), this.reserve0.raw)));
            // pylonShare =  JSBI.add(pylonShare, JSBI.divide(JSBI.multiply(pylonShare, this.reserve0.raw), JSBI.multiply(ptTR0, TWO) ))

        }

        return JSBI.divide(JSBI.multiply(pylonShare, tokenAmount), maxPoolTK)
    }

    private getLiquidityFromPoolTokensLiquidity(tokenAmountA: JSBI, tokenAmountB: JSBI, totalSupply: JSBI, ptb: JSBI, ptTotalSupply: TokenAmount,
                                                isAnchor: boolean, anchorVirtualBalance?: JSBI, gamma?: JSBI): JSBI {
        console.log(tokenAmountA.toString(), tokenAmountB.toString(), ptTotalSupply.raw.toString())
        let amount: JSBI;

        let pairReserveTranslated0 = this.translateToPylon(this.pair!.reserve0.raw, ptb, totalSupply);
        let pairReserveTranslated1 = this.translateToPylon(this.pair!.reserve1.raw, ptb, totalSupply);
        if (isAnchor){
            let amountA = JSBI.divide(JSBI.multiply(pairReserveTranslated1, JSBI.multiply(tokenAmountA, TWO)), pairReserveTranslated0);
            let amountB = JSBI.multiply(tokenAmountB, TWO);
            // 211977961326582515044
            // 211978800000000000000
            amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA;
        }else{
            // changing values on reserves because fees are swapped only on float changing the reserve
            // just for precision purposes
            let amountA = JSBI.divide(JSBI.multiply(pairReserveTranslated0, JSBI.multiply(tokenAmountB, TWO)), pairReserveTranslated1);
            let amountB = JSBI.multiply(tokenAmountA, TWO);
            amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA;
        }

        return this.calculatePTU(isAnchor, amount, totalSupply, ptb, ptTotalSupply, anchorVirtualBalance, gamma);
    }

    private getOmegaSlashing(gamma: JSBI, vab: JSBI, ptb: JSBI, ptt: JSBI, amount: JSBI ) : JSBI {
        let pairRSTR = this.translateToPylon(this.pair!.reserve1.raw, ptb, ptt);
        let omegaSlashing = JSBI.divide(JSBI.multiply(JSBI.subtract(BASE, gamma), JSBI.multiply(pairRSTR, TWO)), JSBI.subtract(vab, this.reserve1.raw));
        omegaSlashing = JSBI.lessThan(omegaSlashing, BASE) ? omegaSlashing : BASE;
        //Send slashing should send the extra PTUs to Uniswap.
        //When burn calls the uniswap burn it will also give users the compensation
        return  JSBI.divide(JSBI.multiply(amount, omegaSlashing), BASE)
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

        let liquidityFloat: JSBI = this.calculatePTU(false,  tokenAmountA.raw, totalSupply.raw, ZERO, new TokenAmount(this.floatLiquidityToken, ZERO), vab, gamma);
        let liquidityAnchor: JSBI = this.calculatePTU(true,  tokenAmountB.raw, totalSupply.raw, ZERO, new TokenAmount(this.anchorLiquidityToken, ZERO), vab, gamma);
        return [liquidityFloat, liquidityAnchor];
    }

    public getOneSideLiquidity(reserve: JSBI, otherReserve: JSBI, otherBalance: JSBI, amount: JSBI, factory: PylonFactory, totalSupply: JSBI): JSBI{
        let fee = JSBI.divide(factory.liquidityFee, TWO)
        let k = sqrt(JSBI.multiply(otherBalance, JSBI.add(reserve, JSBI.divide(JSBI.multiply(amount, JSBI.subtract(_10000, JSBI.add(fee, ONE))), _10000))));
        let kBefore = sqrt(JSBI.multiply(reserve, otherReserve))
        return JSBI.divide(JSBI.multiply(totalSupply, JSBI.subtract(k, kBefore)), kBefore)
    }

    // public getAnchorAsync100LiquidityMinted(
    //     totalSupply: TokenAmount,
    //     anchorTotalSupply: TokenAmount,
    //     tokenAmount: TokenAmount,
    //     anchorVirtualBalance: BigintIsh,
    //     muMulDecimals: BigintIsh,
    //     gamma: BigintIsh,
    //     ptb: TokenAmount,
    //     feeValueAnchor: BigintIsh,
    //     strikeBlock: BigintIsh,
    //     blockNumber: BigintIsh,
    //     factory: PylonFactory,
    //     emaBlockNumber: BigintIsh,
    //     gammaEMA: BigintIsh,
    //     thisBlockEMA: BigintIsh
    // ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
    //     invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'LIQUIDITY')
    //     invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
    //     invariant(tokenAmount.token.equals(this.token1), 'TOKEN')
    //     let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
    //     let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
    //         parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
    //     let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
    //     if (fee.blocked) {
    //         return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
    //     }
    //     let halfAmountA = new TokenAmount(this.token1, JSBI.divide(fee.newAmount, TWO));
    //     let outputAmount = this.pair.getOutputAmount(halfAmountA);
    //     let liquidity = this.getLiquidityFromPoolTokensLiquidity(outputAmount[0].raw, halfAmountA.raw, totalSupply, ptb, anchorTotalSupply, true, result.vab)
    //
    //     if (!JSBI.greaterThan(liquidity, ZERO)) {
    //         throw new InsufficientInputAmountError()
    //     }
    //     return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied}
    // }
    // public getFloatAsync100LiquidityMinted(
    //     totalSupply: TokenAmount,
    //     floatTotalSupply: TokenAmount,
    //     tokenAmount: TokenAmount,
    //     anchorVirtualBalance: BigintIsh,
    //     muMulDecimals: BigintIsh,
    //     gamma: BigintIsh,
    //     ptb: TokenAmount,
    //     feeValueAnchor: BigintIsh,
    //     strikeBlock: BigintIsh,
    //     blockNumber: BigintIsh,
    //     factory: PylonFactory,
    //     emaBlockNumber: BigintIsh,
    //     gammaEMA: BigintIsh,
    //     thisBlockEMA: BigintIsh
    // ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean} {
    //     invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'LIQUIDITY')
    //     invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
    //     invariant(tokenAmount.token.equals(this.token0), 'TOKEN')
    //
    //     let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), ptb, totalSupply, parseBigintIsh(feeValueAnchor), parseBigintIsh(muMulDecimals))
    //     let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
    //         parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
    //     let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
    //     this.changePairReserveonFloatSwap(fee.fee)
    //     if (fee.blocked) {
    //         return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
    //     }
    //
    //     let halfAmountA = new TokenAmount(this.token0, JSBI.divide(fee.newAmount, TWO));
    //     let outputAmount = this.pair.getOutputAmount(halfAmountA)
    //
    //     let liquidity = this.getLiquidityFromPoolTokensLiquidity(halfAmountA.raw, outputAmount[0].raw, totalSupply, ptb, floatTotalSupply, false, result.vab, result.gamma)
    //
    //     if (!JSBI.greaterThan(liquidity, ZERO)) {
    //         throw new InsufficientInputAmountError()
    //     }
    //     return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied}
    // }

    public getAnchorAsyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount,
        anchorVirtualBalance: BigintIsh,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh,
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean, feePercentage: JSBI} {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        const tokenAmounts = [tokenAmountA, tokenAmountB];
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);
        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))

        let fee1 = this.applyDeltaAndGammaTax(tokenAmountA.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        let fee2 = this.applyDeltaAndGammaTax(tokenAmountB.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        this.changePairReserveonFloatSwap(fee1.fee)


        if (fee1.blocked || fee2.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true, feePercentage: ZERO}
        }
        let liquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.newAmount, fee2.newAmount, newTotalSupply, ptb.raw, anchorTotalSupply, true, result.vab)
        let feeLiquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.fee, fee2.fee, newTotalSupply, ptb.raw, anchorTotalSupply, true, result.vab, result.gamma)
        let feePercentage = JSBI.divide(JSBI.multiply(feeLiquidity, BASE), liquidity)

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
            deltaApplied: fee1.deltaApplied || fee2.deltaApplied, feePercentage: feePercentage}
    }



    private publicMintFeeCalc(kLast: JSBI, totalSupply: JSBI, pylonFactory: PylonFactory): JSBI {
        if (JSBI.notEqual(kLast, ZERO)) {
            let rootK = sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw))
            let rootKLast = sqrt(kLast)
            if (JSBI.greaterThan(rootK, rootKLast)) {
                let numerator = JSBI.multiply(JSBI.subtract(rootK, rootKLast), BASE)
                let denominator = JSBI.add(JSBI.multiply(rootK, pylonFactory.dynamicRatio), rootKLast)
                let fee = JSBI.divide(numerator, denominator)
                return JSBI.divide(JSBI.multiply(fee, totalSupply), BASE)
            }
        }
        return ZERO
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
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh
    ): {liquidity: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean, feePercentage: JSBI} {
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')

        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        const tokenAmounts =  [tokenAmountA, tokenAmountB];
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))

        let fee1 = this.applyDeltaAndGammaTax(tokenAmountA.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        let fee2 = this.applyDeltaAndGammaTax(tokenAmountB.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        this.changePairReserveonFloatSwap(fee1.fee)
        if (fee1.blocked || fee2.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true, feePercentage: ZERO}
        }

        let liquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.newAmount, fee2.newAmount, newTotalSupply, ptb.raw, floatTotalSupply, false, result.vab, result.gamma)
        let feeLiquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.fee, fee2.fee, newTotalSupply, ptb.raw, floatTotalSupply, false, result.vab, result.gamma)
        let feePercentage = JSBI.divide(JSBI.multiply(feeLiquidity, BASE), liquidity)

        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }

        return {liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
            deltaApplied: fee1.deltaApplied || fee2.deltaApplied, feePercentage: feePercentage}

    }

    public getAnchorSyncLiquidityMinted(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh
    ): { amountsToInvest?: { sync: JSBI; async: JSBI }; extraSlippagePercentage?: JSBI; blocked: boolean; fee: TokenAmount; liquidity: TokenAmount; deltaApplied: boolean; feePercentage: JSBI } {
        invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token1), 'TOKEN')
        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), parseBigintIsh(factory.EMASamples), parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
        let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        let feePercentage = JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount)
        if (fee.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true, feePercentage: ZERO}
        }

        let pairReserveTranslated = this.translateToPylon(this.pair!.reserve1.raw, ptb.raw, newTotalSupply);
        let amountsToInvest = this.handleSyncAndAsync(factory.maxSync, pairReserveTranslated, this.reserve1.raw, fee.newAmount)
        let syncLiquidity = ZERO
        if (JSBI.greaterThan(amountsToInvest.sync, ZERO)) {
            syncLiquidity = this.calculatePTU(true, amountsToInvest.sync, newTotalSupply, ptb.raw, anchorTotalSupply, result.vab);
        }
        let asyncLiquidity: JSBI = ZERO;
        let extraSlippagePercentage = ZERO;
        if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {

            let sqrtK = sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw ))
            let amounInWithFee = JSBI.divide(JSBI.multiply(amountsToInvest.async, JSBI.subtract(_10000, JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE))), _10000)
            extraSlippagePercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amounInWithFee), BASE), amountsToInvest.async)
            let sqrtKPrime = sqrt(JSBI.multiply(JSBI.add(this.getPairReserves()[1].raw, amounInWithFee), this.getPairReserves()[0].raw))
            let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)

            asyncLiquidity = this.getLiquidityFromPoolTokensLiquidity(JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, liqPercentage), BASE),
                JSBI.divide(JSBI.multiply(this.getPairReserves()[1].raw, liqPercentage), BASE), newTotalSupply, ptb.raw, anchorTotalSupply, true, result.vab, result.gamma)
        }
        let liquidity: JSBI = JSBI.add(syncLiquidity, asyncLiquidity);
        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return {
            liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity),
            blocked: false,
            fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
            deltaApplied: fee.deltaApplied,
            amountsToInvest: amountsToInvest,
            extraSlippagePercentage: extraSlippagePercentage,
            feePercentage: feePercentage
        }
    }


    public getFloatSyncLiquidityMinted(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmount: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh
    ): { amountsToInvest?: { sync: JSBI; async: JSBI }; extraSlippagePercentage?: JSBI; blocked: boolean; fee: TokenAmount; liquidity: TokenAmount; deltaApplied: boolean; feePercentage: JSBI } {
        invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
        invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
        //invariant((pair.token0.equals(this.token0) && pair.token1.equals(this.token1)) || (pair.token0.equals(this.token1) && pair.token1.equals(this.token0)), 'LIQUIDITY')
        invariant(tokenAmount.token.equals(this.token0), 'TOKEN')
        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))

        let fee = this.applyDeltaAndGammaTax(tokenAmount.raw, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        let feePercentage = JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount)

        if (fee.blocked) {
            return {liquidity: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true, feePercentage: ZERO}
        }
        this.changePairReserveonFloatSwap(fee.fee)

        let pairReserveTranslated = this.translateToPylon(this.pair!.reserve0.raw, ptb.raw, newTotalSupply);
        let amountsToInvest = this.handleSyncAndAsync(factory.maxSync, pairReserveTranslated, this.reserve0.raw, fee.newAmount)
        let syncLiquidity: JSBI = ZERO
        if (JSBI.greaterThan(amountsToInvest.sync, ZERO)) {
            syncLiquidity = this.calculatePTU(false, amountsToInvest.sync, newTotalSupply, ptb.raw, floatTotalSupply, result.vab, result.gamma);
        }
        let asyncLiquidity: JSBI = ZERO;
        let extraSlippagePercentage = ZERO;
        if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
            // let halfAmountA = new TokenAmount(this.token0, JSBI.divide(amountsToInvest.async, TWO));
            // let outputAmount = this.pair.getOutputAmount(halfAmountA)
            let sqrtK = sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw ))
            let amounInWithFee = JSBI.divide(JSBI.multiply(amountsToInvest.async, JSBI.subtract(_10000, JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE))), _10000)
            let sqrtKPrime = sqrt(JSBI.multiply(JSBI.add(this.getPairReserves()[0].raw, amounInWithFee), this.getPairReserves()[1].raw))
            extraSlippagePercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amounInWithFee), BASE), amountsToInvest.async)

            let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)

            asyncLiquidity = this.getLiquidityFromPoolTokensLiquidity(JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, liqPercentage), BASE),
                JSBI.divide(JSBI.multiply(this.getPairReserves()[1].raw, liqPercentage), BASE), newTotalSupply, ptb.raw, floatTotalSupply, false, result.vab, result.gamma)
        }
        let liquidity = JSBI.add(syncLiquidity, asyncLiquidity);
        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        // 95113082759130264 4500005175824747
        // 94756618014081722 4500005175824747
        return {
            liquidity: new TokenAmount(this.anchorLiquidityToken, liquidity),
            blocked: false,
            fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
            deltaApplied: fee.deltaApplied,
            amountsToInvest: amountsToInvest,
            extraSlippagePercentage: extraSlippagePercentage,
            feePercentage: feePercentage
        }
    }

    public burnFloat(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh
    ): {amount: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean}  {
        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))

        let reservesPTU = this.calculatePTU(false, this.reserve0.raw, newTotalSupply, ptb.raw, floatTotalSupply, result.vab, result.gamma);
        let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU;

        let ptuAmount = this.calculatePTUToAmount(
            newTotalSupply,
            floatTotalSupply,
            new TokenAmount(tokenAmountOut.token, minAmount),
            result.vab,
            result.gamma,
            ptb.raw,
            false
        )

        let fee1 = this.applyDeltaAndGammaTax(ptuAmount, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        if (fee1.blocked) {
            return {amount: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }
        kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
        let amount = fee1.newAmount

         // amount: JSBI = ZERO;
        if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {
            let adjustedLiq = JSBI.subtract(tokenAmountOut.raw, reservesPTU);
            // console.log("adjustedLiq", adjustedLiq.toString(10))
            let lptu = this.calculateLPTU(newTotalSupply, floatTotalSupply, adjustedLiq, result.vab, result.gamma, ptb.raw, false);
            let fee = this.applyDeltaAndGammaTax(lptu, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
            console.log("fee", fee1.fee.toString())
            this.changePairReserveonFloatSwap(fee1.fee)

            //604705541361411447
            let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), newTotalSupply, factory)
            newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

            let amount0 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[0].raw), newTotalSupply);
            let amount1 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[1].raw), newTotalSupply);
            let newPair = new Pair(new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
                new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)));


            let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token1, amount1));
            // console.log("amount", amount.toString(10))

            amount =  JSBI.add(amount, JSBI.add(amount0, amountTransformed[0].raw));
            // console.log("amount", amount.toString(10))

        }

        // this.changePairReserveonFloatSwap(fee1.fee)
        return {amount: new TokenAmount(tokenAmountOut.token, amount), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee1.fee), deltaApplied: fee1.deltaApplied}
    }
    public burnAnchor(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh
    ): {amount: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean}  {
        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))

        let reservesPTU = this.calculatePTU(true, this.reserve1.raw, newTotalSupply, ptb.raw, anchorTotalSupply, result.vab, result.gamma);
        let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU;
        let ptuAmount = this.calculatePTUToAmount(
            newTotalSupply,
            anchorTotalSupply,
            new TokenAmount(tokenAmountOut.token, minAmount),
            result.vab,
            result.gamma,
            ptb.raw,
            true
        )
        let fee1 = this.applyDeltaAndGammaTax(ptuAmount, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        if (fee1.blocked) {
            return {amount: new TokenAmount(this.anchorLiquidityToken, ZERO), blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }
        let amount = fee1.newAmount

        if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {

            let adjustedLiq = JSBI.subtract(tokenAmountOut.raw, reservesPTU);
            // console.log("adjustedLiq", adjustedLiq.toString(10))
            let lptu = this.calculateLPTU(newTotalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, ptb.raw, true);
            let fee = this.applyDeltaAndGammaTax(lptu, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);

            let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, ptb.raw, newTotalSupply, fee.newAmount);
            // let adjustedLiq = JSBI.divide(JSBI.multiply(omega, JSBI.subtract(tokenAmountOut.raw, reservesPTU)), BASE);
            // let lptu = this.calculateLPTU(newTotalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, ptb.raw, true);
            // let fee = this.applyDeltaAndGammaTax(lptu, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);

            let amount0 = JSBI.divide(JSBI.multiply(omegaPTU, this.getPairReserves()[0].raw), totalSupply.raw);
            let amount1 = JSBI.divide(JSBI.multiply(omegaPTU, this.getPairReserves()[1].raw), totalSupply.raw);

            let newPair = new Pair(new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
                new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)));

            let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token0, amount0));

            amount = JSBI.add(fee1.newAmount, JSBI.add(amount1, amountTransformed[0].raw));
        }

        return {amount: new TokenAmount(tokenAmountOut.token, amount), blocked: false, fee: new TokenAmount(this.anchorLiquidityToken, fee1.fee), deltaApplied: fee1.deltaApplied}
    }

    public burnAsyncAnchor(
        totalSupply: TokenAmount,
        anchorTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh
    ): {amountA: TokenAmount, amountB: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean,  asyncBlocked: boolean} {

        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
        let lptu = this.calculateLPTU(newTotalSupply, anchorTotalSupply, tokenAmountOut.raw, result.vab, result.gamma, ptb.raw, true);
        let fee = this.applyDeltaAndGammaTax(lptu, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        if (fee.blocked) {
            return {amountA: new TokenAmount(this.anchorLiquidityToken, ZERO), amountB: new TokenAmount(this.anchorLiquidityToken, ZERO), asyncBlocked: false, blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }
        let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, ptb.raw, newTotalSupply, fee.newAmount);

        let amount0 = JSBI.divide(JSBI.multiply(omegaPTU, this.getPairReserves()[0].raw), newTotalSupply);
        let amount1 = JSBI.divide(JSBI.multiply(omegaPTU, this.getPairReserves()[1].raw), newTotalSupply);

        return {amountA: new TokenAmount(this.token0, amount0), amountB: new TokenAmount(this.token1, amount1), asyncBlocked: fee.asyncBlocked, blocked: fee.blocked, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied};
    }

    public burnAsyncFloat(
        totalSupply: TokenAmount,
        floatTotalSupply: TokenAmount,
        tokenAmountOut: TokenAmount,
        anchorVirtualBalance: BigintIsh | JSBI,
        muMulDecimals: BigintIsh,
        gamma: BigintIsh,
        ptb: TokenAmount,
        strikeBlock: BigintIsh,
        blockNumber: BigintIsh,
        factory: PylonFactory,
        emaBlockNumber: BigintIsh,
        gammaEMA: BigintIsh,
        thisBlockEMA: BigintIsh,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        kLast: BigintIsh
    ): {amountA: TokenAmount, amountB: TokenAmount, blocked: boolean, fee: TokenAmount, deltaApplied: boolean, asyncBlocked: boolean} {

        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let ema = this.calculateEMA(parseBigintIsh(emaBlockNumber), parseBigintIsh(blockNumber), parseBigintIsh(strikeBlock),
            parseBigintIsh(gammaEMA), factory.EMASamples, parseBigintIsh(thisBlockEMA), parseBigintIsh(gamma), parseBigintIsh(result.gamma))
        let lptu = this.calculateLPTU(newTotalSupply, floatTotalSupply, tokenAmountOut.raw, result.vab, result.gamma, ptb.raw, false);
        let fee = this.applyDeltaAndGammaTax(lptu, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
        if (fee.blocked) {
            return {amountA: new TokenAmount(this.anchorLiquidityToken, ZERO), amountB: new TokenAmount(this.anchorLiquidityToken, ZERO), asyncBlocked: false, blocked: true, fee: new TokenAmount(this.anchorLiquidityToken, ZERO), deltaApplied: true}
        }
        let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, ptb.raw, newTotalSupply, fee.newAmount);

        let amount0 = JSBI.divide(JSBI.multiply(omegaPTU, this.getPairReserves()[0].raw), newTotalSupply);
        let amount1 = JSBI.divide(JSBI.multiply(omegaPTU, this.getPairReserves()[1].raw), newTotalSupply);

        return {amountA: new TokenAmount(this.token0, amount0), amountB: new TokenAmount(this.token1, amount1), asyncBlocked: fee.asyncBlocked, blocked: fee.blocked, fee: new TokenAmount(this.anchorLiquidityToken, fee.fee), deltaApplied: fee.deltaApplied};
    }

    public getLiquidityValue(
        totalSupply: TokenAmount,
        ptTotalSupply: TokenAmount,
        liquidity: TokenAmount,
        anchorVirtualBalance: JSBI,
        ptb: TokenAmount,
        muMulDecimals: BigintIsh,
        kLast: JSBI,
        factory: PylonFactory,
        lastRootK: BigintIsh,
        anchorKFactor: BigintIsh,
        isLineFormula: boolean,
        isAnchor: boolean
    ): [TokenAmount, TokenAmount]  {
        // invariant(this.involvesToken(token), 'TOKEN')
        invariant(totalSupply.token.equals(this.anchorLiquidityToken) || totalSupply.token.equals(this.floatLiquidityToken), 'TOTAL_SUPPLY')
        // invariant(liquidity.token.equals(this.anchorLiquidityToken) || liquidity.token.equals(this.floatLiquidityToken), 'LIQUIDITY')
        // invariant(JSBI.lessThanOrEqual(liquidity.raw, totalSupply.raw), 'LIQUIDITY')
        let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
        let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted);

        let result = this.updateSync(parseBigintIsh(anchorVirtualBalance), parseBigintIsh(lastRootK),
            parseBigintIsh(anchorKFactor), isLineFormula,
            ptb.raw, newTotalSupply, parseBigintIsh(muMulDecimals))

        let lptu = this.calculateLPTU(newTotalSupply, ptTotalSupply, liquidity.raw, result.vab, result.gamma, ptb.raw, isAnchor);

        return [this.pair.getLiquidityValue(this.token0, totalSupply, new TokenAmount(this.pair.liquidityToken, lptu)),
            this.pair.getLiquidityValue(this.token1, totalSupply, new TokenAmount(this.pair.liquidityToken, lptu))]

        // let totalSupplyAdjusted: TokenAmount
        // if (!feeOn) {
        //     totalSupplyAdjusted = totalSupply
        // } else {
        //     invariant(!!kLast, 'K_LAST')
        //     const kLastParsed = parseBigintIsh(kLast)
        //     if (!JSBI.equal(kLastParsed, ZERO)) {
        //         const rootK = sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw))
        //         const rootKLast = sqrt(kLastParsed)
        //         if (JSBI.greaterThan(rootK, rootKLast)) {
        //             const numerator = JSBI.multiply(totalSupply.raw, JSBI.subtract(rootK, rootKLast))
        //             const denominator = JSBI.add(JSBI.multiply(rootK, FIVE), rootKLast)
        //             const feeLiquidity = JSBI.divide(numerator, denominator)
        //             totalSupplyAdjusted = totalSupply.add(new TokenAmount(liquidity.token, feeLiquidity))
        //         } else {
        //             totalSupplyAdjusted = totalSupply
        //         }
        //     } else {
        //         totalSupplyAdjusted = totalSupply
        //     }
        // }
        //
        // return new TokenAmount(
        //     token,
        //     JSBI.divide(JSBI.multiply(liquidity.raw, this.reserveOf(token).raw), totalSupplyAdjusted.raw)
        // )
    }
}

