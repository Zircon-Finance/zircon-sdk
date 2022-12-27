import { TokenAmount } from './fractions/tokenAmount'
import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { AbiCoder } from '@ethersproject/abi'
import { pack, keccak256 } from '@ethersproject/solidity'
import { getCreate2Address } from '@ethersproject/address'
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
  DOUBLE_BASE,
  EN_FACTORY_ADDRESS,
  EN_CODE_HASH,
  _200,
  MIGRATION_PYLONS,
  PT_BYTECODE
} from '../constants'
import { sqrt, parseBigintIsh } from '../utils'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import { Token } from './token'
import { Pair } from '../entities'
import { PylonFactory } from 'entities/pylonFactory'
import { BurnAsyncParams, BurnParams, MintAsyncParams, MintSyncParams } from 'interfaces/pylonInterface'

let PYLON_ADDRESS_CACHE: { [pair: string]: { [tokenAddress: string]: string } } = {}
let MIGRATED_PYLON_ADDRESS_CACHE: { [pair: string]: { [tokenAddress: string]: string } } = {}
let PT_ADDRESS_CACHE: { [tokenAddress: string]: { [pylonAddress: string]: string } } = {}
let ENERGY_ADDRESS_CACHE: { [tokenAddress: string]: { [pairAddress: string]: string } } = {}

export class Pylon {
  public readonly floatLiquidityToken: Token
  public readonly anchorLiquidityToken: Token
  public pair: Pair
  public tokenAmounts: [TokenAmount, TokenAmount]
  public readonly address: string

  public static getAddress(tokenA: Token, tokenB: Token): string {
    const pairAddress: string = Pair.getAddress(tokenA, tokenB)
    if (PYLON_ADDRESS_CACHE?.[pairAddress]?.[tokenA.address] === undefined) {
      PYLON_ADDRESS_CACHE = {
        ...PYLON_ADDRESS_CACHE,
        [pairAddress]: {
          ...PYLON_ADDRESS_CACHE?.[pairAddress],
          [tokenA.address]: getCreate2Address(
              PYLON_FACTORY_ADDRESS[tokenA.chainId],
              keccak256(
                  ['bytes'],
                  [pack(['address', 'address', 'address'], [tokenA.address, tokenB.address, pairAddress])]
              ),
              PYLON_CODE_HASH[tokenA.chainId]
          )
        }
      }
    }
    return PYLON_ADDRESS_CACHE[pairAddress][tokenA.address]
  }
  public static getMigratedAddress(tokenA: Token, tokenB: Token, address: string, bytecode: string): string {
    const pairAddress: string = Pair.getAddress(tokenA, tokenB)
    if (MIGRATED_PYLON_ADDRESS_CACHE?.[pairAddress]?.[tokenA.address] === undefined) {
      MIGRATED_PYLON_ADDRESS_CACHE = {
        ...MIGRATED_PYLON_ADDRESS_CACHE,
        [pairAddress]: {
          ...MIGRATED_PYLON_ADDRESS_CACHE?.[pairAddress],
          [tokenA.address]: getCreate2Address(
              address,
              keccak256(
                  ['bytes'],
                  [pack(['address', 'address', 'address'], [tokenA.address, tokenB.address, pairAddress])]
              ),
              bytecode
          )
        }
      }
    }
    return MIGRATED_PYLON_ADDRESS_CACHE[pairAddress][tokenA.address]
  }
  public static migratedPTCodeHash = (migrationAddress: string, chainId: ChainId): string =>
      keccak256(
          ['bytes'],
          [pack(['bytes', 'bytes'], [PT_BYTECODE[chainId], new AbiCoder().encode(['address'], [migrationAddress])])]
      )
  public static ptCodeHash = (token: Token): string =>
      keccak256(
          ['bytes'],
          [
            pack(
                ['bytes', 'bytes'],
                [PT_BYTECODE[token.chainId], new AbiCoder().encode(['address'], [PYLON_FACTORY_ADDRESS[token.chainId]])]
            )
          ]
      )
  private static getPTAddress(tokenA: Token, tokenB: Token, isAnchor: boolean): string {
    let token = isAnchor ? tokenB : tokenA
    let pylonAddress = this.getAddress(tokenA, tokenB)
    if (PT_ADDRESS_CACHE?.[token.address]?.[pylonAddress] === undefined) {
      PT_ADDRESS_CACHE = {
        ...PT_ADDRESS_CACHE,
        [token.address]: {
          ...PT_ADDRESS_CACHE?.[token.address],
          [pylonAddress]: getCreate2Address(
              PT_FACTORY_ADDRESS[token.chainId],
              keccak256(['bytes'], [pack(['address', 'address'], [token.address, pylonAddress])]),
              Pylon.ptCodeHash(token)
          )
        }
      }
    }

    return PT_ADDRESS_CACHE[token.address][pylonAddress]
  }
  private static getMigratedPTAddress(
      tokenA: Token,
      tokenB: Token,
      isAnchor: boolean,
      migrationAddress: string,
      bytecode: string
  ): string {
    let token = isAnchor ? tokenB : tokenA
    let pylonAddress = this.getMigratedAddress(tokenA, tokenB, migrationAddress, bytecode)
    if (PT_ADDRESS_CACHE?.[token.address]?.[pylonAddress] === undefined) {
      PT_ADDRESS_CACHE = {
        ...PT_ADDRESS_CACHE,
        [token.address]: {
          ...PT_ADDRESS_CACHE?.[token.address],
          [pylonAddress]: getCreate2Address(
              PT_FACTORY_ADDRESS[token.chainId],
              keccak256(['bytes'], [pack(['address', 'address'], [token.address, pylonAddress])]),
              Pylon.migratedPTCodeHash(migrationAddress, token.chainId)
          )
        }
      }
    }

    return PT_ADDRESS_CACHE[token.address][pylonAddress]
  }

  public static getEnergyAddress(tokenA: Token, tokenB: Token): string | undefined {
    if (tokenA && tokenB) {
      let pairAddress = Pair.getAddress(tokenA, tokenB)
      if (ENERGY_ADDRESS_CACHE?.[tokenA.address]?.[Pair.getAddress(tokenA, tokenB)] === undefined) {
        ENERGY_ADDRESS_CACHE = {
          ...ENERGY_ADDRESS_CACHE,
          [tokenA.address]: {
            ...ENERGY_ADDRESS_CACHE?.[tokenA.address],
            [pairAddress]: getCreate2Address(
                EN_FACTORY_ADDRESS[tokenA.chainId],
                keccak256(['bytes'], [pack(['address', 'address'], [pairAddress, tokenA.address])]),
                EN_CODE_HASH[tokenA.chainId]
            )
          }
        }
      }
      return ENERGY_ADDRESS_CACHE[tokenA.address][pairAddress]
    } else {
      return undefined
    }
  }

  public static getLiquidityAddresses(tokenA: Token, tokenB: Token): [string, string] {
    let pylonAddress = this.getAddress(tokenA, tokenB)
    let floatLiquidityAddress
    let anchorLiquidityAddress
    let migrationInformation = MIGRATION_PYLONS[pylonAddress]
    if (migrationInformation) {
      floatLiquidityAddress = Pylon.getMigratedPTAddress(
          tokenA,
          tokenB,
          false,
          migrationInformation.migrationAddress,
          migrationInformation.bytecode
      )
      anchorLiquidityAddress = Pylon.getMigratedPTAddress(
          tokenA,
          tokenB,
          true,
          migrationInformation.migrationAddress,
          migrationInformation.bytecode
      )
    } else {
      floatLiquidityAddress = Pylon.getPTAddress(tokenA, tokenB, false)
      anchorLiquidityAddress = Pylon.getPTAddress(tokenA, tokenB, true)
    }
    return [floatLiquidityAddress, anchorLiquidityAddress]
  }

  public constructor(pair: Pair, tokenAmount0: TokenAmount, tokenAmount1: TokenAmount) {
    const tokenAmounts = [tokenAmount0, tokenAmount1]
    this.address = Pylon.getAddress(tokenAmounts[0].token, tokenAmounts[1].token)
    this.pair = pair
    let floatLiquidityAddress
    let anchorLiquidityAddress
    let migrationInformation = MIGRATION_PYLONS[this.address]
    if (migrationInformation) {
      floatLiquidityAddress = Pylon.getMigratedPTAddress(
          tokenAmount0.token,
          tokenAmount1.token,
          false,
          migrationInformation.migrationAddress,
          migrationInformation.bytecode
      )
      anchorLiquidityAddress = Pylon.getMigratedPTAddress(
          tokenAmount0.token,
          tokenAmount1.token,
          true,
          migrationInformation.migrationAddress,
          migrationInformation.bytecode
      )
    } else {
      floatLiquidityAddress = Pylon.getPTAddress(tokenAmount0.token, tokenAmount1.token, false)
      anchorLiquidityAddress = Pylon.getPTAddress(tokenAmount0.token, tokenAmount1.token, true)
    }

    this.floatLiquidityToken = new Token(tokenAmounts[0].token.chainId, floatLiquidityAddress, 18, 'ZR-FT', 'Zircon FT')

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
    } else {
      return [this.pair.reserve1, this.pair.reserve0]
    }
  }

  /// @notice This calculates the Health Factor of the Pylon
  // The conditions are:
  // High -> Omega >= 1 && Price >= breakevenPrice
  // Medium -> Omega >= .95 && anchorReserve + poolTokenReserve > (1-Omega) * TPV
  // Low -> Omega <= .95 || anchorReserve + poolTokenReserve < (1-Omega) * TPV
  public getHealthFactor(
      vab: BigintIsh,
      ptb: TokenAmount,
      ptt: TokenAmount,
      reserveAnchorEnergy: BigintIsh,
      ptbEnergy: BigintIsh,
      isLineFormula: boolean,
      muMulDecimals: BigintIsh,
      lastRootK: BigintIsh,
      anchorKFactor: BigintIsh,
      kLast: BigintIsh,
      factory: PylonFactory
  ): String {
    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return ''
    }
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), ptt.raw, factory)
    let newTotalSupply = JSBI.add(ptt.raw, ptMinted)
    let result = this.updateSync(
        parseBigintIsh(vab),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    let resTR1 = this.translateToPylon(this.getPairReserves()[1].raw, ptb.raw, ptt.raw)
    // let percentageAnchorEnergy = JSBI.divide(
    //     JSBI.multiply(JSBI.add(parseBigintIsh(reserveAnchorEnergy), this.reserve1.raw), BASE),
    //     result.vab
    // )

    let ptbInAnchor = JSBI.multiply(TWO,
        JSBI.divide(
            JSBI.multiply(parseBigintIsh(ptbEnergy),
                this.getPairReserves()[1].raw),
            ptt.raw))

    let anchorOnTPV = JSBI.divide(
        JSBI.multiply(
            JSBI.add(
                parseBigintIsh(reserveAnchorEnergy),
                ptbInAnchor),
            BASE),
    JSBI.multiply(TWO, resTR1))

    console.log(anchorOnTPV.toString())


    // let percentagePTBEnergy = JSBI.divide(
    //     JSBI.multiply(parseBigintIsh(ptbEnergy), JSBI.divide(JSBI.multiply(result.vab, BASE), resTR1)),
    //     BASE
    // )
    console.log("ptbEnergy", JSBI.toNumber(parseBigintIsh(ptbEnergy)))
    console.log("vab", result.vab.toString())
    console.log("vab", result.vab.toString())


    let omega = this.getOmegaSlashing(result.gamma, result.vab, ptb.raw, ptt.raw, BASE).newAmount

    console.log("omega", omega.toString())
    console.log("gamma", result.gamma.toString())
    console.log("vab", result.vab.toString())
    // console.log("percentageAnchorEnergy", percentageAnchorEnergy.toString())
    // console.log("percentagePTBEnergy", percentagePTBEnergy.toString())
    console.log("ptb", ptb.raw.toString())
    console.log("ptt", ptt.raw.toString())
    console.log("res1", this.getPairReserves()[1].raw.toString())
    console.log("isLineFormula", isLineFormula)

    if (JSBI.greaterThanOrEqual(omega, BASE) && !isLineFormula) {
      return 'high'
    } else if (
        JSBI.greaterThanOrEqual(omega, JSBI.subtract(BASE, JSBI.BigInt(4000000000000000))) ||
        JSBI.greaterThanOrEqual(anchorOnTPV, JSBI.subtract(BASE, omega))
    ) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  private translateToPylon(toTranslate: JSBI, ptb: JSBI, ptt: JSBI) {
    return JSBI.divide(JSBI.multiply(toTranslate, ptb), ptt)
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
  private calculateGamma(
      resTR1: JSBI,
      anchorKFactor: JSBI,
      adjVAB: JSBI,
      isLineFormula: boolean
  ): { gamma: JSBI; isLineFormula: boolean } {
    let tpva = JSBI.multiply(resTR1, TWO)
    console.log('tpva', tpva.toString())
    console.log('adjVAB', adjVAB.toString())
    console.log('anchorKFactor', anchorKFactor.toString())


    let sqrtKFactor = sqrt(
        JSBI.multiply(JSBI.subtract(JSBI.divide(JSBI.exponentiate(anchorKFactor, TWO), BASE), anchorKFactor), BASE)
    )

    let vabMultiplier = JSBI.lessThan(sqrtKFactor, anchorKFactor)
        ? JSBI.subtract(anchorKFactor, sqrtKFactor)
        : JSBI.add(anchorKFactor, sqrtKFactor)

    let reserveSwitch = JSBI.divide(JSBI.multiply(adjVAB, vabMultiplier), BASE)
    let gamma: JSBI

    // 3278082107575138965412 3346474818817985187312 3334565848820947565995 1000296986162934852
    // 3278082107575138965412 3346474818817985187312 3334565848820947565995
    // rs  983061140848131578

    if (JSBI.greaterThan(resTR1, reserveSwitch)) {
      gamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(adjVAB, BASE), tpva))
      return { gamma, isLineFormula: isLineFormula }
    } else {
      gamma = JSBI.divide(JSBI.multiply(BASE, tpva), JSBI.multiply(FOUR, adjVAB))
      gamma = JSBI.divide(JSBI.multiply(gamma, BASE), anchorKFactor)
      return { gamma, isLineFormula: true }
    }
  }

  private updateSync(
      vabLast: JSBI,
      lastRootK: JSBI,
      anchorKFactor: JSBI,
      isLineFormula: boolean,
      ptb: JSBI,
      ptt: JSBI,
      muMulDecimals: JSBI
  ): { gamma: JSBI; vab: JSBI; anchorKFactor: JSBI; isLineFormula: boolean } {
    // Calculating Total Pool Value Anchor Prime
    let resTR0 = this.translateToPylon(this.getPairReserves()[0].raw, ptb, ptt)
    let resTR1 = this.translateToPylon(this.getPairReserves()[1].raw, ptb, ptt)

    let rootK = sqrt(JSBI.multiply(resTR0, resTR1))

    let feeValuePercentageAnchor = JSBI.divide(JSBI.multiply(JSBI.subtract(rootK, lastRootK), muMulDecimals), lastRootK)
    let anchorK = anchorKFactor
    if (JSBI.notEqual(feeValuePercentageAnchor, ZERO)) {
      let feeToAnchor = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, resTR1), feeValuePercentageAnchor), BASE)
      let adjVAB = JSBI.subtract(vabLast, this.reserve1.raw)

      anchorK = this.calculateAnchorFactor(
          isLineFormula,
          JSBI.divide(JSBI.multiply(feeToAnchor, adjVAB), vabLast),
          anchorKFactor,
          JSBI.subtract(vabLast, this.reserve1.raw),
          JSBI.divide(JSBI.multiply(resTR0, JSBI.subtract(BASE, feeValuePercentageAnchor)), BASE),
          JSBI.divide(JSBI.multiply(resTR1, JSBI.subtract(BASE, feeValuePercentageAnchor)), BASE)
      )

      vabLast = JSBI.add(vabLast, feeToAnchor)
    }

    let adjVAB = JSBI.subtract(vabLast, this.reserve1.raw)

    let gamma = this.calculateGamma(resTR1, anchorK, adjVAB, isLineFormula)
    return { gamma: gamma.gamma, vab: vabLast, anchorKFactor: anchorK, isLineFormula: gamma.isLineFormula }
  }

  private changePairReserveonFloatSwap(fee: JSBI, liquidityFee: JSBI) {
    if (JSBI.greaterThan(fee, ZERO)) {
      let outputAmount = this.pair.getOutputAmount(new TokenAmount(this.token0, fee))
      // console.log("SDK:: fee", fee.toString(), outputAmount.toString());

      let reserves = this.getPairReserves()
      let isFloatR0 = this.token0.equals(this.pair.token0)
      let ta0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, fee))
      let ta1 = new TokenAmount(this.token1, JSBI.subtract(reserves[1].raw, outputAmount[0].raw))

      this.pair = new Pair(isFloatR0 ? ta0 : ta1, isFloatR0 ? ta1 : ta0, liquidityFee)
    }
  }

  public static calculateLiquidity(gamme: BigintIsh, reserve: BigintIsh, ptb: BigintIsh, ptt: BigintIsh): JSBI {
    return JSBI.divide(
        JSBI.multiply(
            JSBI.subtract(BASE, parseBigintIsh(gamme)),
            JSBI.divide(
                JSBI.multiply(JSBI.multiply(parseBigintIsh(reserve), TWO), parseBigintIsh(ptb)),
                parseBigintIsh(ptt)
            )
        ),
        BASE
    )
  }

  private calculatePTUToAmount(
      totalSupply: JSBI,
      floatTotalSupply: TokenAmount,
      tokenAmount: TokenAmount,
      anchorVirtualBalance: JSBI,
      ptb: JSBI,
      gamma: JSBI,
      isAnchor: boolean
  ): JSBI {
    if (isAnchor) {
      return JSBI.divide(JSBI.multiply(anchorVirtualBalance, tokenAmount.raw), floatTotalSupply.raw)
    } else {
      //(((_reserve0.mul(_gamma).mul(2)/1e18).add(_reservePylon0)).mul(_ptuAmount))/_totalSupply
      return JSBI.divide(
          JSBI.multiply(
              JSBI.add(
                  JSBI.divide(
                      JSBI.multiply(
                          JSBI.multiply(JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, ptb), totalSupply), gamma),
                          TWO
                      ),
                      BASE
                  ),
                  this.reserve0.raw
              ),
              tokenAmount.raw
          ),
          floatTotalSupply.raw
      )
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
    let sqrtKFactor = sqrt(
        JSBI.multiply(JSBI.subtract(JSBI.divide(JSBI.exponentiate(oldKFactor, TWO), BASE), oldKFactor), BASE)
    )
    let vabFactor = JSBI.lessThan(sqrtKFactor, oldKFactor)
        ? JSBI.subtract(oldKFactor, sqrtKFactor)
        : JSBI.add(oldKFactor, sqrtKFactor)
    let amountTres = JSBI.divide(JSBI.multiply(resTR1, DOUBLE_BASE), JSBI.multiply(adjVAB, vabFactor))

    if (isLineFormula || JSBI.greaterThanOrEqual(amountTres, BASE)) {
      if (
          !isLineFormula &&
          JSBI.lessThan(JSBI.add(BASE, JSBI.divide(JSBI.multiply(amount, BASE), adjVAB)), amountTres)
      ) {
        return oldKFactor
      }
      let kFormFalse = JSBI.multiply(
          JSBI.add(
              resTR0,
              JSBI.multiply(
                  JSBI.divide(JSBI.multiply(JSBI.subtract(amountTres, BASE), adjVAB), TWO),
                  JSBI.divide(resTR0, resTR1)
              )
          ),
          JSBI.add(resTR1, JSBI.divide(JSBI.multiply(JSBI.subtract(amountTres, BASE), adjVAB), TWO))
      )

      // TODO: use the new overflow-safe math functions
      //
      //               //splitting to avoid overflow chance
      //                 uint initialHalfK = isLineFormula
      // +                                ? _reserveTranslated0
      //     +                                : (_reserveTranslated0 + ((amountThresholdMultiplier - 1e18).mul(adjustedVab)/2 * _reserveTranslated0/_reserveTranslated1));
      // +
      //     +            uint initialTailK = isLineFormula
      // +                                ? _reserveTranslated1
      //     +                                : (_reserveTranslated1 + (amountThresholdMultiplier - 1e18).mul(adjustedVab)/2);
      //
      // uint initialVab = isLineFormula ? adjustedVab : (amountThresholdMultiplier).mul(adjustedVab)/1e18;
      //
      //
      // -            uint kPrime = (_reserveTranslated0 + (_amount.mul(_reserveTranslated0)/(2*_reserveTranslated1))).mul(_reserveTranslated1 + _amount/2);
      // +            //divide by halfK to start working through 1e18s
      //     +            uint kPrime = (_reserveTranslated0 + (_amount.mul(_reserveTranslated0)/(2*_reserveTranslated1))).mul(_reserveTranslated1 + _amount/2)
      //     +                            / initialHalfK;

      let initialK = isLineFormula ? JSBI.multiply(resTR1, resTR0) : kFormFalse

      let initialVAB = isLineFormula ? adjVAB : JSBI.divide(JSBI.multiply(amountTres, adjVAB), BASE)

      let kPrime = JSBI.multiply(
          JSBI.add(resTR0, JSBI.divide(JSBI.multiply(amount, resTR0), JSBI.multiply(TWO, resTR1))),
          JSBI.add(resTR1, JSBI.divide(amount, TWO))
      )

      let anchorKFac = JSBI.divide(JSBI.multiply(kPrime, initialVAB), initialK)
      anchorKFac = JSBI.divide(JSBI.multiply(anchorKFac, oldKFactor), JSBI.add(adjVAB, amount))

      return JSBI.lessThan(anchorKFac, BASE) ? BASE : anchorKFac
    } else {
      return oldKFactor
    }
  }

  private calculateEMA(
      emaBlockNumber: JSBI,
      currentBlockNumber: JSBI,
      strikeBlock: JSBI,
      gammaEMA: JSBI,
      EMASamples: JSBI,
      thisBlockEMA: JSBI,
      oldGamma: JSBI,
      gamma: JSBI
  ): JSBI {
    // Calculating Total Pool Value Anchor Prime
    let blockDiff = JSBI.subtract(currentBlockNumber, emaBlockNumber)
    if (JSBI.equal(blockDiff, ZERO)) {
      let blockEMA: JSBI
      if (JSBI.greaterThan(gamma, oldGamma)) {
        blockEMA = JSBI.subtract(gamma, oldGamma)
      } else {
        blockEMA = JSBI.subtract(oldGamma, gamma)
      }

      blockEMA = JSBI.add(thisBlockEMA, blockEMA)
      if (JSBI.greaterThan(gammaEMA, blockEMA)) {
        return gammaEMA
      } else {
        return blockEMA
      }
    } else {
      let bleed = ZERO
      if (JSBI.greaterThan(JSBI.subtract(currentBlockNumber, strikeBlock), TEN)) {
        bleed = JSBI.divide(blockDiff, TEN)
      }
      let newGammaEMA = JSBI.divide(
          JSBI.add(JSBI.multiply(gammaEMA, EMASamples), thisBlockEMA),
          JSBI.add(JSBI.add(EMASamples, ONE), bleed)
      )
      let blockEMA: JSBI
      if (JSBI.greaterThan(gamma, oldGamma)) {
        blockEMA = JSBI.subtract(gamma, oldGamma)
      } else {
        blockEMA = JSBI.subtract(oldGamma, gamma)
      }

      if (JSBI.greaterThan(newGammaEMA, blockEMA)) {
        return newGammaEMA
      } else {
        return blockEMA
      }
    }
  }

  private calculatePTU(
      isAnchor: boolean,
      tokenAmount: JSBI,
      ptt: JSBI,
      ptb: JSBI,
      ptTotalSupply: TokenAmount,
      anchorVirtualBalance?: JSBI,
      gamma?: JSBI
  ): JSBI {
    invariant(
        ptTotalSupply.token.equals(this.anchorLiquidityToken) || ptTotalSupply.token.equals(this.floatLiquidityToken),
        'NEGATIVE'
    )
    let liquidity: JSBI
    if (isAnchor) {
      if (JSBI.equal(ptTotalSupply.raw, ZERO)) {
        liquidity = JSBI.subtract(tokenAmount, MINIMUM_LIQUIDITY)
      } else {
        liquidity = JSBI.divide(JSBI.multiply(ptTotalSupply.raw, tokenAmount), anchorVirtualBalance!)
      }
    } else {
      let denominator: JSBI
      if (JSBI.equal(ptTotalSupply.raw, ZERO)) {
        denominator = JSBI.multiply(TWO, gamma!)
      } else {
        let pairReserveTranslated = this.translateToPylon(this.getPairReserves()[0].raw, ptb, ptt)
        denominator = JSBI.add(
            JSBI.divide(JSBI.multiply(JSBI.multiply(pairReserveTranslated, gamma!), TWO), BASE),
            this.reserve0.raw
        )
      }

      if (JSBI.equal(ptTotalSupply.raw, ZERO)) {
        liquidity = JSBI.subtract(JSBI.divide(JSBI.multiply(BASE, tokenAmount), denominator), MINIMUM_LIQUIDITY)
      } else {
        liquidity = JSBI.divide(JSBI.multiply(ptTotalSupply.raw, tokenAmount), denominator)
      }
    }

    return liquidity
  }

  private handleSyncAndAsync(
      maxSync: JSBI,
      reserveTranslated: JSBI,
      reserve: JSBI,
      amountIn: JSBI
  ): { sync: JSBI; async: JSBI } {
    let max = JSBI.divide(JSBI.multiply(reserveTranslated, maxSync), _100)

    let freeSpace = ZERO
    if (JSBI.greaterThan(max, reserve)) {
      freeSpace = JSBI.subtract(max, reserve)
      if (JSBI.greaterThan(freeSpace, amountIn)) {
        return {
          sync: amountIn,
          async: ZERO
        }
      }
    }
    let amountAsync = JSBI.subtract(amountIn, freeSpace)
    return {
      sync: freeSpace,
      async: amountAsync
    }
  }

  private getFeeByGamma(gamma: JSBI, minFee: JSBI, maxFee: JSBI): JSBI {
    let gammaHalf = JSBI.BigInt(5e17)
    let x: JSBI
    if (JSBI.greaterThan(gamma, gammaHalf)) {
      x = JSBI.multiply(JSBI.subtract(gamma, gammaHalf), TEN)
    } else {
      x = JSBI.multiply(JSBI.subtract(gammaHalf, gamma), TEN)
    }

    let minThreshold = JSBI.BigInt(45e16)
    let maxThreshold = JSBI.BigInt(55e16)
    if (JSBI.lessThanOrEqual(gamma, minThreshold) || JSBI.greaterThanOrEqual(gamma, maxThreshold)) {
      return JSBI.divide(JSBI.multiply(JSBI.multiply(maxFee, x), x), JSBI.BigInt(25e36))
    } else {
      return JSBI.add(
          JSBI.divide(JSBI.multiply(JSBI.multiply(JSBI.multiply(minFee, x), x), JSBI.BigInt(36)), DOUBLE_BASE),
          minFee
      )
    }
  }

  private applyDeltaAndGammaTax(
      amount: JSBI,
      strikeBlock: JSBI,
      blockNumber: JSBI,
      gamma: JSBI,
      pylonFactory: PylonFactory,
      maxDerivative: JSBI
  ): { newAmount: JSBI; fee: JSBI; deltaApplied: boolean; blocked: boolean; asyncBlocked: boolean } {
    let getFeeByGamma = this.getFeeByGamma(gamma, pylonFactory.minFee, pylonFactory.maxFee)

    if (JSBI.greaterThanOrEqual(maxDerivative, pylonFactory.deltaGammaThreshold)) {
      let strikeDiff = JSBI.subtract(blockNumber, strikeBlock)
      let cooldownBlocks = JSBI.divide(BASE, pylonFactory.deltaGammaThreshold)

      if (JSBI.lessThanOrEqual(strikeDiff, cooldownBlocks)) {
        let feeBPS = JSBI.add(
            JSBI.add(
                JSBI.subtract(JSBI.divide(JSBI.multiply(maxDerivative, _10000), pylonFactory.deltaGammaThreshold), _10000),
                pylonFactory.deltaGammaFee
            ),
            getFeeByGamma
        )
        if (JSBI.greaterThan(feeBPS, _10000)) {
          return {
            newAmount: ZERO,
            fee: ZERO,
            deltaApplied: false,
            blocked: true,
            asyncBlocked: false
          }
        } else {
          let fee = JSBI.divide(JSBI.multiply(feeBPS, amount), _10000)
          return {
            newAmount: JSBI.subtract(amount, fee),
            fee,
            deltaApplied: true,
            blocked: false,
            asyncBlocked: false
          }
        }
      } else {
        let fee = JSBI.divide(JSBI.multiply(getFeeByGamma, amount), _10000)
        return {
          newAmount: JSBI.subtract(amount, fee),
          fee,
          deltaApplied: false,
          blocked: false,
          asyncBlocked: true
        }
      }
    }

    let fee = JSBI.divide(JSBI.multiply(getFeeByGamma, amount), _10000)
    return { newAmount: JSBI.subtract(amount, fee), fee, deltaApplied: false, blocked: false, asyncBlocked: false }
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
      isAnchor: boolean
  ): JSBI {
    let pylonShare: JSBI
    let maxPoolTK: JSBI
    let ptTR0 = this.translateToPylon(this.getPairReserves()[0].raw, ptb, totalSupply)
    let ptTR1 = this.translateToPylon(this.getPairReserves()[1].raw, ptb, totalSupply)
    if (isAnchor) {
      pylonShare = JSBI.divide(
          JSBI.multiply(ptb, JSBI.subtract(anchorVirtualBalance, this.reserve1.raw)),
          JSBI.multiply(TWO, ptTR1)
      )
      maxPoolTK = JSBI.subtract(
          ptTotalSupply.raw,
          JSBI.divide(JSBI.multiply(ptTotalSupply.raw, this.reserve1.raw), anchorVirtualBalance)
      )
      // pylonShare = JSBI.add(pylonShare, JSBI.divide(JSBI.multiply(pylonShare, this.reserve1.raw), JSBI.multiply(ptTR1, TWO) ))
    } else {
      pylonShare = JSBI.divide(JSBI.multiply(gamma, ptb), BASE)
      maxPoolTK = JSBI.subtract(
          ptTotalSupply.raw,
          JSBI.divide(
              JSBI.multiply(ptTotalSupply.raw, this.reserve0.raw),
              JSBI.add(JSBI.divide(JSBI.multiply(JSBI.multiply(ptTR0, TWO), gamma), BASE), this.reserve0.raw)
          )
      )
      // pylonShare =  JSBI.add(pylonShare, JSBI.divide(JSBI.multiply(pylonShare, this.reserve0.raw), JSBI.multiply(ptTR0, TWO) ))
    }

    return JSBI.divide(JSBI.multiply(pylonShare, tokenAmount), maxPoolTK)
  }

  private getLiquidityFromPoolTokensLiquidity(
      tokenAmountA: JSBI,
      tokenAmountB: JSBI,
      totalSupply: JSBI,
      ptb: JSBI,
      ptTotalSupply: TokenAmount,
      isAnchor: boolean,
      anchorVirtualBalance?: JSBI,
      gamma?: JSBI
  ): JSBI {
    let amount: JSBI

    let pairReserveTranslated0 = this.translateToPylon(this.getPairReserves()[0].raw, ptb, totalSupply)
    let pairReserveTranslated1 = this.translateToPylon(this.getPairReserves()[1].raw, ptb, totalSupply)
    if (isAnchor) {
      let amountA = JSBI.divide(
          JSBI.multiply(pairReserveTranslated1, JSBI.multiply(tokenAmountA, TWO)),
          pairReserveTranslated0
      )
      let amountB = JSBI.multiply(tokenAmountB, TWO)
      amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA
    } else {
      // changing values on reserves because fees are swapped only on float changing the reserve
      // just for precision purposes
      let amountA = JSBI.divide(
          JSBI.multiply(pairReserveTranslated0, JSBI.multiply(tokenAmountB, TWO)),
          pairReserveTranslated1
      )
      let amountB = JSBI.multiply(tokenAmountA, TWO)
      amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA
    }

    return this.calculatePTU(isAnchor, amount, totalSupply, ptb, ptTotalSupply, anchorVirtualBalance, gamma)
  }

  //589288951922912
  //589288951922912
  private getOmegaSlashing(
      gamma: JSBI,
      vab: JSBI,
      ptb: JSBI,
      ptt: JSBI,
      amount: JSBI
  ): { omega: JSBI; newAmount: JSBI } {
    let pairRSTR = this.translateToPylon(this.getPairReserves()[1].raw, ptb, ptt)

    let omegaSlashing = JSBI.divide(
        JSBI.multiply(JSBI.subtract(BASE, gamma), JSBI.multiply(pairRSTR, TWO)),
        JSBI.subtract(vab, this.reserve1.raw)
    )
    omegaSlashing = JSBI.lessThan(omegaSlashing, BASE) ? omegaSlashing : BASE

    return { omega: omegaSlashing, newAmount: JSBI.divide(JSBI.multiply(amount, omegaSlashing), BASE) }
  }

  public slashedTokens(
      energyPTBalance: JSBI,
      amountPTU: JSBI,
      omegaSlashing: JSBI
  ): { ptuToAdd: JSBI; percentage: JSBI } {
    if (JSBI.lessThan(omegaSlashing, BASE)) {
      let amountToAdd = JSBI.divide(JSBI.multiply(JSBI.subtract(BASE, omegaSlashing), amountPTU), BASE)
      console.log('amountToAdd', amountToAdd.toString())
      if (JSBI.lessThan(amountToAdd, energyPTBalance)) {
        return { ptuToAdd: amountToAdd, percentage: ZERO }
      } else {
        let extraPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(amountToAdd, energyPTBalance), BASE), amountPTU)
        return { ptuToAdd: energyPTBalance, percentage: extraPercentage }
      }
    }
    return { ptuToAdd: ZERO, percentage: ZERO }
  }

  public anchorSlash(
      stableAmount: JSBI,
      floatAmount: JSBI,
      extraPercentage: JSBI,
      anchorEnergyBalance: JSBI
  ): { extraStable: JSBI } {
    if (JSBI.greaterThan(extraPercentage, ZERO)) {
      let totalAmount = JSBI.add(
          stableAmount,
          JSBI.divide(JSBI.multiply(floatAmount, this.getPairReserves()[1].raw), this.getPairReserves()[0].raw)
      )

      let originalAmount = JSBI.divide(JSBI.multiply(totalAmount, BASE), JSBI.subtract(BASE, extraPercentage))

      let amountToTransfer = JSBI.subtract(originalAmount, totalAmount)
      let extraStable = JSBI.greaterThan(amountToTransfer, anchorEnergyBalance) ? anchorEnergyBalance : amountToTransfer
      console.log('extraStable', amountToTransfer.toString())
      return { extraStable: extraStable }
    }
    return { extraStable: ZERO }
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
    return [
      outputAmount,
      new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount), this.pair.liquidityFee)
    ]
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
    return [
      inputAmount,
      new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount), this.pair.liquidityFee)
    ]
  }

  public initializeValues(
      totalSupply: TokenAmount,
      tokenAmountA: TokenAmount,
      tokenAmountB: TokenAmount
  ): [JSBI, JSBI] {
    let balance0 = tokenAmountA.raw
    let vab = tokenAmountB.raw
    let gamma

    if (JSBI.equal(this.getPairReserves()[1].raw, ZERO)) {
      gamma = JSBI.BigInt('500000000000000000')
    } else {
      let tpva = JSBI.add(
          vab,
          JSBI.multiply(balance0, JSBI.divide(this.getPairReserves()[1].raw, this.getPairReserves()[0].raw))
      )
      if (JSBI.lessThan(vab, JSBI.divide(tpva, TWO))) {
        gamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(vab, JSBI.multiply(vab, BASE)), tpva))
      } else {
        gamma = JSBI.divide(JSBI.multiply(tpva, BASE), JSBI.multiply(vab, FOUR))
      }
    }

    let liquidityFloat: JSBI = this.calculatePTU(
        false,
        tokenAmountA.raw,
        totalSupply.raw,
        ZERO,
        new TokenAmount(this.floatLiquidityToken, ZERO),
        vab,
        gamma
    )
    let liquidityAnchor: JSBI = this.calculatePTU(
        true,
        tokenAmountB.raw,
        totalSupply.raw,
        ZERO,
        new TokenAmount(this.anchorLiquidityToken, ZERO),
        vab,
        gamma
    )
    return [liquidityFloat, liquidityAnchor]
  }

  public getOneSideLiquidity(
      reserve: JSBI,
      otherReserve: JSBI,
      amount: JSBI,
      factory: PylonFactory,
      totalSupply: JSBI
  ): JSBI {
    let fee = JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE)
    let k = sqrt(
        JSBI.multiply(
            otherReserve,
            JSBI.add(reserve, JSBI.divide(JSBI.multiply(JSBI.subtract(_10000, fee), amount), _10000))
        )
    )
    let kBefore = sqrt(JSBI.multiply(reserve, otherReserve))
    return JSBI.divide(JSBI.multiply(totalSupply, JSBI.subtract(k, kBefore)), kBefore)
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
  ): MintAsyncParams {
    const blockedReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO
    }

    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockedReturn
    }

    invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
    invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
    const tokenAmounts = [tokenAmountA, tokenAmountB]
    invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)
    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        factory.EMASamples,
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )

    let fee1 = this.applyDeltaAndGammaTax(
        tokenAmountA.raw,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    let fee2 = this.applyDeltaAndGammaTax(
        tokenAmountB.raw,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    this.changePairReserveonFloatSwap(fee1.fee, factory.liquidityFee)

    if (fee1.blocked || fee2.blocked) {
      return blockedReturn
    }

    let liquidity = this.getLiquidityFromPoolTokensLiquidity(
        fee1.newAmount,
        fee2.newAmount,
        newTotalSupply,
        ptb.raw,
        anchorTotalSupply,
        true,
        result.vab
    )
    let feeLiquidity = this.getLiquidityFromPoolTokensLiquidity(
        fee1.fee,
        fee2.fee,
        newTotalSupply,
        ptb.raw,
        anchorTotalSupply,
        true,
        result.vab,
        result.gamma
    )
    let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(feeLiquidity, BASE), liquidity), _100)

    if (!JSBI.greaterThan(liquidity, ZERO)) {
      throw new InsufficientInputAmountError()
    }
    return {
      amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
      deltaApplied: fee1.deltaApplied || fee2.deltaApplied,
      feePercentage: feePercentage
    }
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
  ): MintAsyncParams {
    const blockedReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO
    }
    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockedReturn
    }
    invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
    invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')

    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)

    const tokenAmounts = [tokenAmountA, tokenAmountB]
    invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )
    // let mu = this.updateMU(parseBigintIsh(blockNumber), muBlockNumber, factory, result.gamma, muOldGamma, parseBigintIsh(muMulDecimals))

    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        factory.EMASamples,
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )

    let fee1 = this.applyDeltaAndGammaTax(
        tokenAmountA.raw,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    let fee2 = this.applyDeltaAndGammaTax(
        tokenAmountB.raw,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    this.changePairReserveonFloatSwap(fee1.fee, factory.liquidityFee)

    if (fee1.blocked || fee2.blocked) {
      return blockedReturn
    }

    let pairReserveTranslated0 = this.translateToPylon(this.getPairReserves()[0].raw, ptb.raw, newTotalSupply)
    let pairReserveTranslated1 = this.translateToPylon(this.getPairReserves()[1].raw, ptb.raw, newTotalSupply)
    let derVFB = JSBI.add(
        this.reserve0.raw,
        JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, result.gamma), pairReserveTranslated0), BASE)
    )

    console.log(
        'SDK:: pairRes0, pairRes1, res0, gamma, derVFB',
        pairReserveTranslated0.toString(),
        pairReserveTranslated1.toString(),
        this.reserve0.raw.toString(),
        result.gamma.toString(),
        derVFB.toString()
    )
    console.log('SDK:: reserve0', this.reserve0.raw.toString())
    //calculate amount added that results in uniPT generation, expressed in float units.

    // let amountA = JSBI.divide(JSBI.multiply(pairReserveTranslated0, JSBI.multiply(fee2.newAmount, TWO)), pairReserveTranslated1);
    // let amountB = JSBI.multiply(fee1.newAmount, TWO);
    // let finalAmount = JSBI.greaterThan(amountA, amountB) ? amountB: amountA;

    // console.log("SDK:: amountA, amountB", amountA.toString(), amountB.toString());

    // now we need to calculate new reserves + new gamma

    let poolAddedLiquidity = JSBI.divide(
        JSBI.multiply(fee1.newAmount, newTotalSupply),
        this.getPairReserves()[0].raw)

    let secondPoolLiq = JSBI.divide(JSBI.multiply(fee2.newAmount, newTotalSupply), this.getPairReserves()[1].raw)

    poolAddedLiquidity = JSBI.greaterThan(poolAddedLiquidity, secondPoolLiq) ? secondPoolLiq : poolAddedLiquidity

    newTotalSupply = JSBI.add(newTotalSupply, poolAddedLiquidity)
    let newPtb = JSBI.add(ptb.raw, poolAddedLiquidity)

    console.log('SDK:: addedLiq, ptb, ptt', poolAddedLiquidity.toString(), newPtb.toString(), newTotalSupply.toString())
    //console.log("SDK:: reserve0", this.reserve0.raw.toString());

    //adding amounts to reserves in memory
    let reserves = this.getPairReserves()
    let isFloatR0 = this.token0.equals(this.pair.token0)

    let newPairReserve0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, fee1.newAmount))
    let newPairReserve1 = new TokenAmount(this.token1, JSBI.add(reserves[1].raw, fee2.newAmount))
    this.pair = new Pair(
        isFloatR0 ? newPairReserve0 : newPairReserve1,
        isFloatR0 ? newPairReserve1 : newPairReserve0,
        this.pair.liquidityFee
    )

    pairReserveTranslated0 = this.translateToPylon(this.getPairReserves()[0].raw, newPtb, newTotalSupply)
    pairReserveTranslated1 = this.translateToPylon(this.getPairReserves()[1].raw, newPtb, newTotalSupply)


    let updateRemovingExcess = this.updateRemovingExcess(
        pairReserveTranslated0,
        pairReserveTranslated1,
        this.reserve0.raw,
        this.reserve1.raw,
        factory,
        newTotalSupply,
        parseBigintIsh(kLast)
    )

    newPtb = JSBI.add(newPtb, updateRemovingExcess.liquidity)
    newTotalSupply = JSBI.add(newTotalSupply, updateRemovingExcess.liquidity)

    pairReserveTranslated0 = this.translateToPylon(this.getPairReserves()[0].raw, newPtb, newTotalSupply)
    pairReserveTranslated1 = this.translateToPylon(this.getPairReserves()[1].raw, newPtb, newTotalSupply)

    let adjustedVab = JSBI.subtract(result.vab, this.reserve1.raw)
    let newGamma = this.calculateGamma(
        pairReserveTranslated1,
        parseBigintIsh(anchorKFactor),
        adjustedVab,
        result.isLineFormula
    )

    let newDerVFB = JSBI.add(
        this.reserve0.raw,
        JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, newGamma.gamma), pairReserveTranslated0), BASE)
    )

    console.log(
        'SDK:: pairRes0, pairRes1, res0, gamma, ndrvfb',
        pairReserveTranslated0.toString(),
        pairReserveTranslated1.toString(),
        this.reserve0.raw.toString(),
        newGamma.gamma.toString(),
        newDerVFB.toString()
    )

    console.log('SDK:: newGamma, adjustedVab', newGamma.gamma.toString(), adjustedVab.toString())

    let liquidity = JSBI.divide(
        JSBI.multiply(floatTotalSupply.raw, JSBI.subtract(JSBI.divide(JSBI.multiply(newDerVFB, BASE), derVFB), BASE)),
        BASE
    )

    // let pussy = JSBI.add(BASE, JSBI.divide(JSBI.multiply(JSBI.BigInt("5514603311808018073"), BASE), JSBI.BigInt("209035717137273630343582699")))
    // let ass = JSBI.divide(JSBI.multiply(pussy, derVFB), BASE)

    // console.log('SDK:: liquidity, nvfb/vfb', pussy.toString(), ass.toString(), liquidity.toString(), JSBI.divide(JSBI.multiply(newDerVFB, BASE), derVFB).toString())
    // let liquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.newAmount, fee2.newAmount, newTotalSupply, ptb.raw, floatTotalSupply, false, result.vab, result.gamma)

    let feeLiquidity = this.getLiquidityFromPoolTokensLiquidity(
        fee1.fee,
        fee2.fee,
        newTotalSupply,
        ptb.raw,
        floatTotalSupply,
        false,
        result.vab,
        result.gamma
    )

    let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(feeLiquidity, BASE), liquidity), _100)

    if (!JSBI.greaterThan(liquidity, ZERO)) {
      throw new InsufficientInputAmountError()
    }

    return {
      amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
      deltaApplied: fee1.deltaApplied || fee2.deltaApplied,
      feePercentage: feePercentage
    }
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
  ): MintSyncParams {
    const blockedReturn = {
      isDerivedVFB: false,
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      extraSlippagePercentage: ZERO,
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      amountsToInvest: { async: ZERO, sync: ZERO }
    }
    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockedReturn
    }
    invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
    invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
    invariant(tokenAmount.token.equals(this.token1), 'TOKEN')
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)

    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        parseBigintIsh(factory.EMASamples),
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )
    let fee = this.applyDeltaAndGammaTax(
        tokenAmount.raw,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    if (fee.blocked) {
      return blockedReturn
    }
    let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount), _100)
    let pairReserveTranslated = this.translateToPylon(this.getPairReserves()[1].raw, ptb.raw, newTotalSupply)
    let amountsToInvest = this.handleSyncAndAsync(
        factory.maxSync,
        pairReserveTranslated,
        this.reserve1.raw,
        fee.newAmount
    )
    let extraSlippagePercentage = ZERO
    let amount = ZERO
    if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
      let sqrtK = sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw))
      let amounInWithFee = JSBI.divide(
          JSBI.multiply(
              amountsToInvest.async,
              JSBI.subtract(_10000, JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE))
          ),
          _10000
      )
      // extraSlippagePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amounInWithFee), BASE), amountsToInvest.async), _100);
      let sqrtKPrime = sqrt(
          JSBI.multiply(JSBI.add(this.getPairReserves()[1].raw, amounInWithFee), this.getPairReserves()[0].raw)
      )
      let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)
      amount = JSBI.divide(JSBI.multiply(JSBI.multiply(liqPercentage, TWO), this.getPairReserves()[1].raw), BASE)
      extraSlippagePercentage = JSBI.multiply(
          JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amount), BASE), amountsToInvest.async),
          _100
      )
    }
    amount = JSBI.add(amount, amountsToInvest.sync)

    let liquidity: JSBI = JSBI.divide(JSBI.multiply(amount, anchorTotalSupply.raw), result.vab)
    if (!JSBI.greaterThan(liquidity, ZERO)) {
      throw new InsufficientInputAmountError()
    }
    return {
      amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
      deltaApplied: fee.deltaApplied,
      amountsToInvest: amountsToInvest,
      extraSlippagePercentage: extraSlippagePercentage,
      feePercentage: feePercentage,
      isDerivedVFB: false
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
  ): MintSyncParams {
    const blockedReturn = {
      isDerivedVFB: false,
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      extraSlippagePercentage: ZERO,
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      amountsToInvest: { async: ZERO, sync: ZERO }
    }
    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockedReturn
    }
    // Doing some checks on the inputs
    invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
    invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
    invariant(tokenAmount.token.equals(this.token0), 'TOKEN')

    // Calculating the change on Total supply if the pair mints new fees at the beginning of the transaction
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)

    // Calculating sync() as in protocol, obtaining new VAB, Gamma, AnchorK and isLineFormula from it
    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    anchorKFactor = result.anchorKFactor
    isLineFormula = result.isLineFormula

    // Ema Calculations to calculate our fees
    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        factory.EMASamples,
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )
    let fee = this.applyDeltaAndGammaTax(
        tokenAmount.raw,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )

    // If fee is blocked, time to return
    if (fee.blocked) {
      return blockedReturn
    }

    // Changing total supply and pair reserves because when paying float fees we are doing a swap
    this.changePairReserveonFloatSwap(fee.fee, factory.liquidityFee)
    let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount), _100) // This is the percentage to show in the UI

    // Calculating Derived VFB
    let pairReserveTranslated0 = this.translateToPylon(this.getPairReserves()[0].raw, ptb.raw, newTotalSupply)
    let pairReserveTranslated1 = this.translateToPylon(this.getPairReserves()[1].raw, ptb.raw, newTotalSupply)
    let derVFB = JSBI.add(
        this.reserve0.raw,
        JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, result.gamma), pairReserveTranslated0), BASE)
    )

    console.log(
        'SDK:: pairRes0, pairRes1, derVFB',
        pairReserveTranslated0.toString(),
        pairReserveTranslated1.toString(),
        derVFB.toString()
    )
    console.log('SDK:: reserve0', this.reserve0.raw.toString())

    let amountsToInvest = this.handleSyncAndAsync(
        factory.maxSync,
        pairReserveTranslated0,
        this.reserve0.raw,
        fee.newAmount
    )

    console.log('SDK:: amountsToInvest Sync, Async', amountsToInvest.sync.toString(), amountsToInvest.async.toString())

    let amount = ZERO
    let extraSlippagePercentage = ZERO

    // If we've async minting
    if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
      let sqrtK = sqrt(JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw))
      let amounInWithFee = JSBI.divide(
          JSBI.multiply(
              amountsToInvest.async,
              JSBI.subtract(_10000, JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE))
          ),
          _10000
      )
      let sqrtKPrime = sqrt(
          JSBI.multiply(JSBI.add(this.getPairReserves()[0].raw, amounInWithFee), this.getPairReserves()[1].raw)
      )
      let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)
      amount = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, liqPercentage), this.getPairReserves()[0].raw), BASE)
      extraSlippagePercentage = JSBI.multiply(
          JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amount), BASE), amountsToInvest.async),
          _100
      )
    }

    amount = JSBI.add(amount, amountsToInvest.sync)

    console.log('SDK:: amount', amount.toString())

    //1420144228965622183
    //1777230419483243917

    let syncMinting = this.syncMinting(
        pairReserveTranslated0,
        pairReserveTranslated1,
        JSBI.add(this.reserve0.raw, fee.newAmount),
        this.reserve1.raw,
        factory,
        newTotalSupply
    )
    console.log('SDK:: syncMinting liquidity', syncMinting.liquidity.toString())
    let newReserve0 = syncMinting.newReserve0
    let newReserve1 = syncMinting.newReserve1
    ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), newTotalSupply, factory)
    kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
    newTotalSupply = JSBI.add(newTotalSupply, ptMinted)

    let newPTB = JSBI.add(ptb.raw, syncMinting.liquidity)
    newTotalSupply = JSBI.add(newTotalSupply, syncMinting.liquidity)

    pairReserveTranslated0 = this.translateToPylon(this.getPairReserves()[0].raw, newPTB, newTotalSupply)
    pairReserveTranslated1 = this.translateToPylon(this.getPairReserves()[1].raw, newPTB, newTotalSupply)

    let updateRemovingExcess = this.updateRemovingExcess(
        pairReserveTranslated0,
        pairReserveTranslated1,
        newReserve0,
        newReserve1,
        factory,
        newTotalSupply,
        parseBigintIsh(kLast)
    )

    console.log(
        'SDK:: pairRes0New, pairRes1New, fee.newAmount',
        pairReserveTranslated0.toString(),
        pairReserveTranslated1.toString(),
        fee.newAmount.toString()
    )

    console.log('SDK:: reserve0New', newReserve0.toString())
    console.log('SDK: rem:res', updateRemovingExcess.liquidity.toString())

    newPTB = JSBI.add(newPTB, updateRemovingExcess.liquidity)
    newTotalSupply = JSBI.add(newTotalSupply, updateRemovingExcess.liquidity)

    pairReserveTranslated0 = this.translateToPylon(this.getPairReserves()[0].raw, newPTB, newTotalSupply)
    pairReserveTranslated1 = this.translateToPylon(this.getPairReserves()[1].raw, newPTB, newTotalSupply)

    let adjustedVab = JSBI.subtract(result.vab, newReserve1)
    let newGamma = this.calculateGamma(
        pairReserveTranslated1,
        parseBigintIsh(anchorKFactor),
        adjustedVab,
        isLineFormula
    )

    let slippagePercentage = JSBI.divide(JSBI.multiply(amount, BASE), fee.newAmount)

    let newDerVFB = JSBI.add(
        newReserve0,
        JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, newGamma.gamma), pairReserveTranslated0), BASE)
    )

    let liquidity = JSBI.divide(
        JSBI.multiply(floatTotalSupply.raw, JSBI.subtract(JSBI.divide(JSBI.multiply(newDerVFB, BASE), derVFB), BASE)),
        BASE
    )

    console.log('SDK:: slippagePercertage', slippagePercentage.toString())
    console.log('SDK:: slippagePercertage', BASE.toString(), liquidity.toString())
    liquidity = JSBI.divide(JSBI.multiply(liquidity, slippagePercentage), BASE)

    console.log(
        'SDK:: newGamma, newDerVFB, liquidity',
        newGamma.gamma.toString(),
        newDerVFB.toString(),
        derVFB.toString(),
        liquidity.toString()
    )
    console.log('SDK:: oldGamma', gamma.toString())

    if (!JSBI.greaterThan(liquidity, ZERO)) {
      return {
        amountsToInvest: { async: ZERO, sync: ZERO },
        extraSlippagePercentage: ZERO,
        amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
        blocked: false,
        fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
        deltaApplied: false,
        feePercentage: ZERO,
        isDerivedVFB: true
      }
    }
    return {
      amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
      deltaApplied: fee.deltaApplied,
      amountsToInvest: amountsToInvest,
      extraSlippagePercentage: extraSlippagePercentage,
      feePercentage: feePercentage,
      isDerivedVFB: false
    }
  }

  private getMaximum(b0: JSBI, b1: JSBI): { maxX: JSBI; maxY: JSBI } {
    //Expresses b1 in units of reserve0

    let px = JSBI.divide(JSBI.multiply(b1, this.getPairReserves()[0].raw), this.getPairReserves()[1].raw)
    if (JSBI.greaterThan(px, b0)) {
      return {
        maxX: b0,
        maxY: JSBI.divide(JSBI.multiply(b0, this.getPairReserves()[1].raw), this.getPairReserves()[0].raw)
      }
    } else {
      return { maxX: px, maxY: b1 }
    }
  }

  private mint(amount0: JSBI, amount1: JSBI, totalSupply: JSBI, update: boolean = true): JSBI {
    let t0 = JSBI.divide(JSBI.multiply(amount0, totalSupply), this.getPairReserves()[0].raw)
    let t1 = JSBI.divide(JSBI.multiply(amount1, totalSupply), this.getPairReserves()[1].raw)
    let liquidity = JSBI.greaterThan(t0, t1) ? t1 : t0
    if (update) {
      let reserves = this.getPairReserves()
      let isFloatR0 = this.token0.equals(this.pair.token0)
      let ta0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, amount0))
      let ta1 = new TokenAmount(this.token1, JSBI.add(reserves[1].raw, amount1))
      this.pair = new Pair(isFloatR0 ? ta0 : ta1, isFloatR0 ? ta1 : ta0, this.pair.liquidityFee)
    }
    return liquidity
  }

  private syncMinting(
      reserveTranslated0: JSBI,
      reserveTranslated1: JSBI,
      balance0: JSBI,
      balance1: JSBI,
      factory: PylonFactory,
      totalSupply: JSBI
  ): { newReserve0: JSBI; newReserve1: JSBI; liquidity: JSBI } {
    let max0 = JSBI.divide(JSBI.multiply(reserveTranslated0, factory.maxSync), _200)
    let max1 = JSBI.divide(JSBI.multiply(reserveTranslated1, factory.maxSync), _200)
    let newReserve0 = balance0
    let newReserve1 = balance1
    let liquidity = ZERO
    let excess0 = ZERO
    let excess1 = ZERO

    if (JSBI.greaterThan(balance0, max0) && JSBI.greaterThan(balance1, max1)) {
      let maximums = this.getMaximum(JSBI.subtract(balance0, max0), JSBI.subtract(balance1, max1))
      excess0 = maximums.maxX
      excess1 = maximums.maxY
      console.log('SDK:: e0, e1', excess0.toString(), excess1.toString())
      //765149733326486355870
      //956073849329192983103
      //3214760772150479
      //4029253167166060
      newReserve0 = JSBI.subtract(balance0, excess0)
      newReserve1 = JSBI.subtract(balance1, excess1)
      liquidity = this.mint(excess0, excess1, totalSupply)
    }

    return { newReserve0: newReserve0, newReserve1: newReserve1, liquidity: liquidity }
  }

  private updateRemovingExcess(
      reserveTranslated0: JSBI,
      reserveTranslated1: JSBI,
      balance0: JSBI,
      balance1: JSBI,
      factory: PylonFactory,
      totalSupply: JSBI,
      kLast: JSBI
  ): { newReserve0: JSBI; newReserve1: JSBI; liquidity: JSBI } {
    let update = false
    let max0 = JSBI.divide(JSBI.multiply(reserveTranslated0, factory.maxSync), _100)
    let max1 = JSBI.divide(JSBI.multiply(reserveTranslated1, factory.maxSync), _100)

    let newReserve0 = ZERO
    let newReserve1 = ZERO
    let liquidity = ZERO
    let excess0 = ZERO
    let excess1 = ZERO

    if (JSBI.greaterThan(balance0, max0)) {
      excess0 = JSBI.subtract(balance0, max0)
      liquidity = JSBI.add(
          liquidity,
          this.getOneSideLiquidity(
              this.getPairReserves()[0].raw,
              this.getPairReserves()[1].raw,
              excess0,
              factory,
              totalSupply
          )
      )
      newReserve0 = max0

      update = true
    } else {
      newReserve0 = balance0
    }

    if (JSBI.greaterThan(balance1, max1)) {
      excess1 = JSBI.subtract(balance1, max1)
      liquidity = JSBI.add(
          liquidity,
          this.getOneSideLiquidity(
              this.getPairReserves()[1].raw,
              this.getPairReserves()[0].raw,
              excess1,
              factory,
              totalSupply
          )
      )

      newReserve1 = max1
      update = true
    } else {
      newReserve1 = balance1
    }

    let ptMinted = ZERO
    if (update) {
      ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply, factory)
    }

    let reserves = this.getPairReserves()
    let ta0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, excess0))
    let ta1 = new TokenAmount(this.token1, JSBI.add(reserves[1].raw, excess1))
    let isFloatR0 = this.token0.equals(this.pair.token0)

    this.pair = new Pair(isFloatR0 ? ta0 : ta1, isFloatR0 ? ta1 : ta0, this.pair.liquidityFee)

    this.tokenAmounts = [new TokenAmount(this.token0, newReserve0), new TokenAmount(this.token1, newReserve1)]
    return { newReserve0: newReserve0, newReserve1: newReserve1, liquidity: JSBI.add(ptMinted, liquidity) }
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
  ): BurnParams {
    const blockReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      omegaSlashingPercentage: ZERO,
      slippage: ZERO,
      reservesPTU: ZERO
    }
    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockReturn
    }
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)
    let feePercentage = ZERO
    let omegaSlashingPercentage = ZERO

    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        factory.EMASamples,
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )

    let reservesPTU = this.calculatePTU(
        false,
        this.reserve0.raw,
        newTotalSupply,
        ptb.raw,
        floatTotalSupply,
        result.vab,
        result.gamma
    )
    let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU

    let ptuAmount = this.calculatePTUToAmount(
        newTotalSupply,
        floatTotalSupply,
        new TokenAmount(tokenAmountOut.token, minAmount),
        result.vab,
        result.gamma,
        ptb.raw,
        false
    )

    let fee1 = this.applyDeltaAndGammaTax(
        ptuAmount,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    if (fee1.blocked) {
      return blockReturn
    }
    kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
    let amount = fee1.newAmount

    feePercentage = JSBI.greaterThan(fee1.newAmount, ZERO)
        ? JSBI.multiply(JSBI.divide(JSBI.multiply(fee1.fee, BASE), fee1.newAmount), _100)
        : ZERO

    // amount: JSBI = ZERO;
    let slippage = ZERO
    if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {
      let adjustedLiq = JSBI.subtract(tokenAmountOut.raw, reservesPTU)
      // console.log("adjustedLiq", adjustedLiq.toString(10))
      let lptu = this.calculateLPTU(
          newTotalSupply,
          floatTotalSupply,
          adjustedLiq,
          result.vab,
          result.gamma,
          ptb.raw,
          false
      )
      let fee = this.applyDeltaAndGammaTax(
          lptu,
          parseBigintIsh(strikeBlock),
          parseBigintIsh(blockNumber),
          result.gamma,
          factory,
          ema
      )
      this.changePairReserveonFloatSwap(fee1.fee, factory.liquidityFee)

      //604705541361411447
      let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), newTotalSupply, factory)
      newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)

      let amount0 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[0].raw), newTotalSupply)
      let amount1 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[1].raw), newTotalSupply)

      let feeAmount0 = JSBI.divide(JSBI.multiply(fee.fee, this.getPairReserves()[0].raw), newTotalSupply)
      let feeAmount1 = JSBI.divide(JSBI.multiply(fee.fee, this.getPairReserves()[1].raw), newTotalSupply)
      let newPair = this.pair
      if (
          JSBI.lessThan(amount0, this.getPairReserves()[0].raw) &&
          JSBI.lessThan(amount1, this.getPairReserves()[1].raw)
      ) {
        newPair = new Pair(
            new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
            new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)),
            this.pair.liquidityFee
        )
      }
      let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token1, amount1))
      let amountTransformedComplete = JSBI.divide(
          JSBI.multiply(amount1, this.getPairReserves()[0].raw),
          this.getPairReserves()[1].raw
      )
      let feeAmountTransformed = newPair.getOutputAmount(new TokenAmount(this.token1, feeAmount1))
      // console.log("amount", amount.toString(10))

      amount = JSBI.add(amount, JSBI.add(amount0, amountTransformed[0].raw))
      slippage = JSBI.divide(JSBI.multiply(amount, BASE), JSBI.add(amount0, amountTransformedComplete))
      feePercentage = JSBI.greaterThan(amount, ZERO)
          ? JSBI.multiply(
              JSBI.divide(
                  JSBI.multiply(JSBI.add(fee1.fee, JSBI.add(feeAmount0, feeAmountTransformed[0].raw)), BASE),
                  amount
              ),
              _100
          )
          : feePercentage
      // console.log("amount", amount.toString(10))
    }

    // this.changePairReserveonFloatSwap(fee1.fee)
    return {
      amountOut: new TokenAmount(tokenAmountOut.token, amount),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, fee1.fee),
      deltaApplied: fee1.deltaApplied,
      feePercentage,
      omegaSlashingPercentage,
      slippage,
      reservesPTU: reservesPTU
    }
  }

  // 9449532550333
  // 49758483
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
      kLast: BigintIsh,
      reservePTEnergy: TokenAmount,
      reserveAnchorEnergy: TokenAmount
  ): BurnParams {
    const blockReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      omegaSlashingPercentage: ZERO,
      slippage: ZERO,
      reservesPTU: ZERO
    }

    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockReturn
    }
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    // kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)

    let feePercentage = ZERO
    let omegaSlashingPercentage = ZERO
    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        factory.EMASamples,
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )

    let reservesPTU = this.calculatePTU(
        true,
        this.reserve1.raw,
        newTotalSupply,
        ptb.raw,
        anchorTotalSupply,
        result.vab,
        result.gamma
    )
    let minAmount = JSBI.greaterThan(reservesPTU, tokenAmountOut.raw) ? tokenAmountOut.raw : reservesPTU
    let ptuAmount = this.calculatePTUToAmount(
        newTotalSupply,
        anchorTotalSupply,
        new TokenAmount(tokenAmountOut.token, minAmount),
        result.vab,
        result.gamma,
        ptb.raw,
        true
    )
    let fee1 = this.applyDeltaAndGammaTax(
        ptuAmount,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )

    if (fee1.blocked) {
      return blockReturn
    }
    let amount = fee1.newAmount
    feePercentage = JSBI.greaterThan(fee1.newAmount, ZERO)
        ? JSBI.multiply(JSBI.divide(JSBI.multiply(fee1.fee, BASE), fee1.newAmount), _100)
        : ZERO
    let slippage = ZERO
    if (JSBI.lessThan(reservesPTU, tokenAmountOut.raw)) {
      let adjustedLiq = JSBI.subtract(tokenAmountOut.raw, reservesPTU)
      // console.log("adjustedLiq", adjustedLiq.toString(10))
      let totalLPTU = this.calculateLPTU(
          newTotalSupply,
          anchorTotalSupply,
          tokenAmountOut.raw,
          result.vab,
          result.gamma,
          ptb.raw,
          true
      )
      let lptu = this.calculateLPTU(
          newTotalSupply,
          anchorTotalSupply,
          adjustedLiq,
          result.vab,
          result.gamma,
          ptb.raw,
          true
      )
      let fee = this.applyDeltaAndGammaTax(
          lptu,
          parseBigintIsh(strikeBlock),
          parseBigintIsh(blockNumber),
          result.gamma,
          factory,
          ema
      )

      let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, ptb.raw, newTotalSupply, fee.newAmount)
      omegaSlashingPercentage = JSBI.multiply(
          JSBI.divide(JSBI.multiply(JSBI.subtract(lptu, omegaPTU.newAmount), BASE), totalLPTU),
          _100
      )
      // let adjustedLiq = JSBI.divide(JSBI.multiply(omega, JSBI.subtract(tokenAmountOut.raw, reservesPTU)), BASE);
      // let lptu = this.calculateLPTU(newTotalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, ptb.raw, true);
      // let fee = this.applyDeltaAndGammaTax(lptu, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
      let slash = this.slashedTokens(parseBigintIsh(reservePTEnergy.raw), fee.newAmount, omegaPTU.omega)
      let liquidity = JSBI.add(omegaPTU.newAmount, slash.ptuToAdd)
      let amount0 = JSBI.divide(JSBI.multiply(liquidity, this.getPairReserves()[0].raw), newTotalSupply)
      let amount1 = JSBI.divide(JSBI.multiply(liquidity, this.getPairReserves()[1].raw), newTotalSupply)

      let newPair = this.pair
      if (
          JSBI.lessThan(amount0, this.getPairReserves()[0].raw) &&
          JSBI.lessThan(amount1, this.getPairReserves()[1].raw)
      ) {
        newPair = new Pair(
            new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
            new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)),
            this.pair.liquidityFee
        )
      }
      let feeAmount0 = JSBI.divide(JSBI.multiply(fee.fee, this.getPairReserves()[0].raw), newTotalSupply)
      let feeAmount1 = JSBI.divide(JSBI.multiply(fee.fee, this.getPairReserves()[1].raw), newTotalSupply)
      let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token0, amount0))
      let amountTransformedComplete = JSBI.divide(
          JSBI.multiply(amount0, this.getPairReserves()[1].raw),
          this.getPairReserves()[0].raw
      )
      let feeAmountTransformed = newPair.getOutputAmount(new TokenAmount(this.token0, feeAmount0))

      amount = JSBI.add(fee1.newAmount, JSBI.add(amount1, amountTransformed[0].raw))
      slippage = JSBI.divide(JSBI.multiply(amount, BASE), JSBI.add(amount0, amountTransformedComplete))

      let extraAmount1 = this.anchorSlash(
          JSBI.add(amount1, amountTransformed[0].raw),
          ZERO,
          slash.percentage,
          parseBigintIsh(reserveAnchorEnergy.raw)
      )
      amount = JSBI.add(amount, extraAmount1.extraStable)

      feePercentage = JSBI.greaterThan(amount, ZERO)
          ? JSBI.multiply(
              JSBI.divide(
                  JSBI.multiply(JSBI.add(fee1.fee, JSBI.add(feeAmount1, feeAmountTransformed[0].raw)), BASE),
                  amount
              ),
              _100
          )
          : feePercentage
    }
    return {
      amountOut: new TokenAmount(tokenAmountOut.token, amount),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, fee1.fee),
      deltaApplied: fee1.deltaApplied,
      feePercentage,
      omegaSlashingPercentage,
      slippage,
      reservesPTU
    }
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
      kLast: BigintIsh,
      reservePTEnergy: TokenAmount,
      reserveAnchorEnergy: TokenAmount
  ): BurnAsyncParams {
    const blockReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      amountOut2: new TokenAmount(this.anchorLiquidityToken, ZERO),
      asyncBlocked: false,
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      omegaSlashingPercentage: ZERO
    }
    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockReturn
    }
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)
    let omegaSlashingPercentage = ZERO
    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        factory.EMASamples,
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )
    let lptu = this.calculateLPTU(
        newTotalSupply,
        anchorTotalSupply,
        tokenAmountOut.raw,
        result.vab,
        result.gamma,
        ptb.raw,
        true
    )
    let fee = this.applyDeltaAndGammaTax(
        lptu,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    if (fee.blocked) {
      return blockReturn
    }
    let feePercentage = JSBI.greaterThan(fee.newAmount, ZERO)
        ? JSBI.multiply(JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount), _100)
        : ZERO
    let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, ptb.raw, newTotalSupply, fee.newAmount)
    omegaSlashingPercentage = JSBI.multiply(
        JSBI.divide(JSBI.multiply(JSBI.subtract(fee.newAmount, omegaPTU.newAmount), BASE), fee.newAmount),
        _100
    )

    let slash = this.slashedTokens(parseBigintIsh(reservePTEnergy.raw), fee.newAmount, omegaPTU.omega)

    let amount0 = JSBI.divide(
        JSBI.multiply(JSBI.add(omegaPTU.newAmount, slash.ptuToAdd), this.getPairReserves()[0].raw),
        newTotalSupply
    )
    let amount1 = JSBI.divide(
        JSBI.multiply(JSBI.add(omegaPTU.newAmount, slash.ptuToAdd), this.getPairReserves()[1].raw),
        newTotalSupply
    )

    let extraAmount1 = this.anchorSlash(amount1, amount0, slash.percentage, parseBigintIsh(reserveAnchorEnergy.raw))

    return {
      amountOut: new TokenAmount(this.token0, amount0),
      amountOut2: new TokenAmount(this.token1, JSBI.add(amount1, extraAmount1.extraStable)),
      asyncBlocked: fee.asyncBlocked,
      blocked: fee.blocked,
      fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
      deltaApplied: fee.deltaApplied,
      feePercentage,
      omegaSlashingPercentage
    }
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
  ): BurnAsyncParams {
    const blockedReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      amountOut2: new TokenAmount(this.anchorLiquidityToken, ZERO),
      asyncBlocked: false,
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      omegaSlashingPercentage: ZERO
    }

    // weird case scenario when interface sends lrk = 0
    if (JSBI.equal(parseBigintIsh(lastRootK), ZERO)) {
      return blockedReturn
    }

    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)

    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )

    let ema = this.calculateEMA(
        parseBigintIsh(emaBlockNumber),
        parseBigintIsh(blockNumber),
        parseBigintIsh(strikeBlock),
        parseBigintIsh(gammaEMA),
        factory.EMASamples,
        parseBigintIsh(thisBlockEMA),
        parseBigintIsh(gamma),
        parseBigintIsh(result.gamma)
    )
    let lptu = this.calculateLPTU(
        newTotalSupply,
        floatTotalSupply,
        tokenAmountOut.raw,
        result.vab,
        result.gamma,
        ptb.raw,
        false
    )
    let fee = this.applyDeltaAndGammaTax(
        lptu,
        parseBigintIsh(strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        ema
    )
    if (fee.blocked) {
      return blockedReturn
    }
    let feePercentage = JSBI.greaterThan(fee.newAmount, ZERO)
        ? JSBI.multiply(JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount), _100)
        : ZERO

    let amount0 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[0].raw), newTotalSupply)
    let amount1 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[1].raw), newTotalSupply)

    return {
      amountOut: new TokenAmount(this.token0, amount0),
      amountOut2: new TokenAmount(this.token1, amount1),
      asyncBlocked: fee.asyncBlocked,
      blocked: fee.blocked,
      fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
      deltaApplied: fee.deltaApplied,
      feePercentage,
      omegaSlashingPercentage: ZERO
    }
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
  ): [TokenAmount, TokenAmount] {
    // invariant(this.involvesToken(token), 'TOKEN')
    invariant(
        totalSupply.token.equals(this.anchorLiquidityToken) || totalSupply.token.equals(this.floatLiquidityToken),
        'TOTAL_SUPPLY'
    )
    // invariant(liquidity.token.equals(this.anchorLiquidityToken) || liquidity.token.equals(this.floatLiquidityToken), 'LIQUIDITY')
    // invariant(JSBI.lessThanOrEqual(liquidity.raw, totalSupply.raw), 'LIQUIDITY')
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)

    let result = this.updateSync(
        parseBigintIsh(anchorVirtualBalance),
        parseBigintIsh(lastRootK),
        parseBigintIsh(anchorKFactor),
        isLineFormula,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(muMulDecimals)
    )
    let lptu = this.calculateLPTU(
        newTotalSupply,
        ptTotalSupply,
        liquidity.raw,
        result.vab,
        result.gamma,
        ptb.raw,
        isAnchor
    )

    return [
      this.pair.getLiquidityValue(this.token0, totalSupply, new TokenAmount(this.pair.liquidityToken, lptu)),
      this.pair.getLiquidityValue(this.token1, totalSupply, new TokenAmount(this.pair.liquidityToken, lptu))
    ]
  }
}
