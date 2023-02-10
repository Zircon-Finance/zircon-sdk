//TODO: add reduce only rejection
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
  _100,
  _10000,
  EN_FACTORY_ADDRESS,
  EN_CODE_HASH,
  _200,
  MIGRATION_PYLONS,
  PT_BYTECODE,
  _112, _56, _97P, TEN, _28, _84
} from '../constants'
import { sqrt, parseBigintIsh } from '../utils'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import { Token } from './token'
import { Pair, Library } from '../entities'
import { PylonFactory } from 'entities/pylonFactory'
import {
  BurnAsyncParams,
  BurnParams, Decimals,
  MintAsyncParams,
  MintSyncParams,
  PairInfo,
  PylonInfo, SyncAsyncParams
} from 'interfaces/pylonInterface'

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
      new Pair(
          inputReserve.add(inputAmount),
          outputReserve.subtract(outputAmount),
          this.pair.lastBlockTimestamp,
          this.pair.liquidityFee
      )
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
      new Pair(
          inputReserve.add(inputAmount),
          outputReserve.subtract(outputAmount),
          this.pair.lastBlockTimestamp,
          this.pair.liquidityFee
      )
    ]
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

  private getPairReservesTranslated(ptb: JSBI, totalSupply: JSBI): [JSBI, JSBI] {
    let r0 = Library.translateToPylon(this.getPairReserves()[0].raw, ptb, totalSupply)
    let r1 = Library.translateToPylon(this.getPairReserves()[1].raw, ptb, totalSupply)
    return [r0, r1]
  }

  // private getPrice(): JSBI {
  //   return JSBI.divide(JSBI.multiply(this.getPairReserves()[1].raw, BASE), this.getPairReserves()[0].raw)
  // }

  /// @notice This calculates the Health Factor of the Pylon
  /// The conditions are:
  /// High -> Omega >= 1 && Price >= breakevenPrice
  /// Medium -> Omega >= .95 && anchorReserve + poolTokenReserve > (1-Omega) * TPV
  /// Low -> Omega <= .95 || anchorReserve + poolTokenReserve < (1-Omega) * TPV
  public getHealthFactor(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      ptbEnergy: BigintIsh,
      reserveAnchorEnergy: BigintIsh,
      debug: boolean = false
  ): String {
    Pylon.logger(debug, "HEALTH FACTOR: Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )

    let resTR1 = this.getPairReservesTranslated(result.ptb, result.totalSupply)[1]

    let ptbInAnchor = JSBI.multiply(
        TWO,
        JSBI.divide(JSBI.multiply(parseBigintIsh(ptbEnergy), this.getPairReserves()[1].raw), result.totalSupply)
    )

    let anchorOnTPV = JSBI.divide(
        JSBI.multiply(JSBI.add(parseBigintIsh(reserveAnchorEnergy), ptbInAnchor), BASE),
        JSBI.multiply(TWO, resTR1)
    )

    let omega = this.getOmegaSlashing(result.gamma, result.vab, result.ptb, result.totalSupply, BASE).newAmount
    Pylon.logger(debug, "Health Factor: Omega=", omega.toString())
    Pylon.logger(debug, "Health Factor: ptbInAnchor=", ptbInAnchor.toString())
    Pylon.logger(debug, "PTB: anchorOnTPV=", anchorOnTPV.toString())

    if (JSBI.greaterThanOrEqual(omega, BASE)) {
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

  public idealBalance(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      poolTokensIn: TokenAmount,
      ptTotalSupply: TokenAmount,
      totalSupply: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      isAnchor: boolean,
      debug: boolean = false
  ): TokenAmount {
    Pylon.logger(debug, "IDEAL AMOUNT: Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )
    let percentagePTB = JSBI.divide(
        JSBI.multiply(poolTokensIn.raw, BASE),
        ptTotalSupply.raw
    )
    let [pairRsTR0,] = this.getPairReservesTranslated(result.ptb, result.totalSupply)
    if (isAnchor) {
      return new TokenAmount(this.token1, JSBI.divide(JSBI.multiply(percentagePTB, result.vab), BASE))
    }else{
      // let pylonRes = JSBI.divide(JSBI.multiply(this.reserve0.raw, pairRsTR1), pairRsTR0)
      let vfb = JSBI.add(JSBI.divide(
          JSBI.multiply(
              JSBI.multiply(TWO, pairRsTR0),
              result.gamma),
          BASE), this.reserve0.raw)

      Pylon.logger(debug, "vfb", vfb.toString())

      return new TokenAmount(this.token0,
          JSBI.divide(
              JSBI.multiply(
                  percentagePTB,
                  vfb),
              BASE)
      )
    }
  }

  // Gets the delta of the current float position as JSBI percentage
  // Delta is how closely the portfolio tracks the changes in the underlying price. E.g. delta of 100% = you own 1 ETH
  // Delta > 100% == leverage/impermanent gain
  // Delta < 100% == dilution/impermanent loss
  public getDelta(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      debug: boolean = false
  ): JSBI {
    Pylon.logger(debug, "DELTA")

    if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
      return ZERO
    }

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )

    let resTR = this.getPairReservesTranslated(result.ptb, result.totalSupply)

    //2 * gamma * res1/1e18
    let ftv = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, result.gamma), resTR[1]), BASE)

    let price = JSBI.divide(JSBI.multiply(resTR[1], parseBigintIsh(decimals.float)), resTR[0])

    let idealDelta = JSBI.divide(JSBI.multiply(ftv, parseBigintIsh(decimals.float)), price)

    //Now we find the delta of the pylon, which is simply the derivative of the function defining ftv

    let adjVAB = JSBI.subtract(result.vab, this.reserve1.raw)

    let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), resTR[1])
    p3x = JSBI.divide(JSBI.multiply(p3x, parseBigintIsh(decimals.float)), resTR[0])

    if(JSBI.greaterThan(price, p3x)) {
      Pylon.logger(debug, "price > p3x")
      //derivative of 2*sqrt(kx) = k/sqrt(kx)

      let k = JSBI.multiply(resTR[0], resTR[1])
      //Divide by float decimals so that the end result is in float

      let kx = sqrt(JSBI.multiply(JSBI.divide(k, parseBigintIsh(decimals.float)), price))

      let realDelta = JSBI.divide(k, kx)
      Pylon.logger(debug, "realDelta: ", realDelta.toString())
      Pylon.logger(debug, "idealDelta: ", idealDelta.toString())

      return JSBI.multiply(
          JSBI.divide(
              JSBI.multiply(
                  realDelta,
                  BASE),
              idealDelta),
          _100)


    } else {
      Pylon.logger(debug, "price < p3x")

      //derivative of the parabola, 2ax + b
      //terms are all in anchor units -> need to convert them to float
      let coefficients = Library.calculateParabolaCoefficients(result.p2x, result.p2y, p3x, adjVAB, decimals, false, debug)

      let firstTerm = JSBI.divide(JSBI.multiply(coefficients.a, price), parseBigintIsh(decimals.anchor))
      firstTerm = JSBI.multiply(TWO, firstTerm)

      let derivative = JSBI.add(firstTerm, coefficients.b)
      let derivativeFloat = JSBI.divide(JSBI.multiply(derivative, parseBigintIsh(decimals.float)), parseBigintIsh(decimals.anchor))
      Pylon.logger(debug, "derivativeFloat: ", derivativeFloat.toString())

      return JSBI.multiply(
          JSBI.divide(
              JSBI.multiply(
                  idealDelta,
                  BASE),
              derivativeFloat),
          _100)
    }
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

  // private calculate

  private processFees(pylonInfo: PylonInfo, decimals: Decimals, tpv: JSBI, feeValuePercentage: JSBI, ptb: JSBI, ts: JSBI, vab: JSBI, debug: boolean):
      {p2x: JSBI, p2y: JSBI, feeFloat: JSBI, feeAnchor: JSBI}{
    Pylon.logger(debug, "PROCESS FEES:")
    let [pairTR0, pairTR1] = this.getPairReservesTranslated(ptb, ts)

    let feeToAnchor = JSBI.divide(
        JSBI.multiply(tpv, feeValuePercentage),
        BASE);

    let feeToFloat =
        JSBI.divide(
            JSBI.multiply(
                JSBI.divide(
                    JSBI.multiply(
                        feeToAnchor,
                        JSBI.subtract(BASE, parseBigintIsh(pylonInfo.muMulDecimals))),
                    BASE),
                pairTR0),
            pairTR1)

    feeToAnchor = JSBI.divide(JSBI.multiply(feeToAnchor, parseBigintIsh(pylonInfo.muMulDecimals)), BASE)
    Pylon.logger(debug, "fees: anchor:", feeToAnchor.toString(), "float", feeToFloat.toString())
    let p2 = {
      p2x: parseBigintIsh(pylonInfo.p2x),
      p2y: JSBI.add(parseBigintIsh(pylonInfo.p2y), JSBI.divide(JSBI.multiply(feeToFloat, parseBigintIsh(pylonInfo.p2x)), BASE))
    }
    Pylon.logger(debug, "P2: X:", p2.p2x.toString(), "Y:", p2.p2y.toString())

    let derivativeCheck = Library.derivativeCheck(
        parseBigintIsh(p2.p2x),
        parseBigintIsh(p2.p2y),
        pairTR0,
        pairTR1,
        JSBI.subtract(JSBI.add(vab,feeToAnchor), this.reserve1.raw),
        decimals,
        debug
    )

    if (derivativeCheck) {
      feeToAnchor = JSBI.divide(
          JSBI.multiply(feeToAnchor, BASE),
          parseBigintIsh(pylonInfo.muMulDecimals))
      return {feeFloat: ZERO, feeAnchor: feeToAnchor, p2x: ZERO, p2y: ZERO}
    }

    return {feeFloat: feeToFloat, feeAnchor: feeToAnchor, p2x: p2.p2x, p2y: p2.p2y}
  }

  private updateSync(
      pylonInfo: PylonInfo,
      ptb: JSBI,
      ptt: JSBI,
      blockTimestamp: JSBI,
      priceCumulativeLast: JSBI,
      rootK: JSBI,
      constants: PylonFactory,
      decimals: Decimals,
      debug: boolean = false
  ): {
    gamma: JSBI
    vab: JSBI
    vfb: JSBI
    isLineFormula: boolean
    lastPrice: JSBI
  } {
    Pylon.logger(debug, "UPDATE SYNC")
    // Calculating Total Pool Value Anchor Prime
    let [resTR0, resTR1] = this.getPairReservesTranslated(ptb, ptt)

    let currentFloatAccumulator = priceCumulativeLast
    let avgPrice = parseBigintIsh(pylonInfo.lastPrice)

    if (
        JSBI.greaterThan(
            blockTimestamp,
            JSBI.add(constants.oracleUpdateSecs, parseBigintIsh(pylonInfo.lastOracleTimestamp))
        )
    ) {
      if (JSBI.greaterThan(blockTimestamp, this.pair.lastBlockTimestamp)) {
        let timeElapsed = JSBI.subtract(blockTimestamp, this.pair.lastBlockTimestamp)
        Pylon.logger(debug, "block timestamp > last block timestamp", timeElapsed.toString())

        let resPair1 = JSBI.leftShift(resTR1, _112)

        let addingFloatAcc = JSBI.multiply(JSBI.divide(resPair1, resTR0), timeElapsed)
        Pylon.logger(debug, "addingFloatAcc", addingFloatAcc.toString())

        currentFloatAccumulator = JSBI.add(
            currentFloatAccumulator,
            addingFloatAcc
        )
      }

      if (JSBI.greaterThan(currentFloatAccumulator, parseBigintIsh(pylonInfo.lastFloatAccumulator))) {
        Pylon.logger(debug, "lastFloatAccumulator:", pylonInfo.lastFloatAccumulator.toString())
        Pylon.logger(debug, "currentFloatAccumulator:", currentFloatAccumulator.toString())
        avgPrice = JSBI.signedRightShift(
            JSBI.divide(
                JSBI.subtract(
                    currentFloatAccumulator,
                    parseBigintIsh(pylonInfo.lastFloatAccumulator)),
                JSBI.subtract(
                    blockTimestamp,
                    parseBigintIsh(pylonInfo.lastOracleTimestamp))),
            _28)
        Pylon.logger(debug,"AVG PRICE:: only _56 shifted", avgPrice.toString())
        avgPrice = JSBI.signedRightShift(JSBI.multiply(avgPrice, parseBigintIsh(decimals.float)), _84)
        Pylon.logger(debug, "current float accumulator > last float accumulator")
        Pylon.logger(debug, "avg price: ", avgPrice.toString())
      }
    }
    let vabLast = parseBigintIsh(pylonInfo.virtualAnchorBalance)
    let vfbLast = parseBigintIsh(pylonInfo.virtualFloatBalance)

    if (JSBI.greaterThan(rootK, parseBigintIsh(pylonInfo.lastRootKTranslated))) {

      let feeValuePercentage = JSBI.divide(
          JSBI.multiply(
              JSBI.subtract(rootK, parseBigintIsh(pylonInfo.lastRootKTranslated)),
              BASE
          ),
          rootK
      )


      let tpv = JSBI.multiply(TWO, this.getPairReservesTranslated(ptb, ptt)[1])
      let pFees = this.processFees(
          pylonInfo,
          decimals,
          tpv,
          feeValuePercentage,
          ptb,
          ptt,
          vabLast,
          debug
      )

      if (JSBI.notEqual(pFees.feeFloat, ZERO) && JSBI.notEqual(pFees.p2x, ZERO)) {
        pylonInfo.p2x = pFees.p2x
        pylonInfo.p2y = pFees.p2y
        vabLast = JSBI.add(vabLast, pFees.feeAnchor)
        vfbLast = JSBI.add(vfbLast, pFees.feeFloat)
      }else{
        vabLast = JSBI.add(vabLast, pFees.feeAnchor)
      }
      // Pylon.logger(debug, "fee value percentage anchor: ", feeValuePercentageAnchor.toString())
      // if (JSBI.notEqual(feeValuePercentageAnchor, ZERO)) {
      //   let feeToAnchor = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, resTR1), feeValuePercentageAnchor), BASE)
      //   vabLast = JSBI.add(vabLast, feeToAnchor)
      //   Pylon.logger(debug, "new VAB: ", vabLast.toString())
      // }
    }
    //447817706268916784
    let adjVAB = JSBI.subtract(vabLast, this.reserve1.raw)
    let gamma = Library.calculateGamma(resTR0, resTR1, adjVAB, parseBigintIsh(pylonInfo.p2x), parseBigintIsh(pylonInfo.p2y), decimals, debug)

    Pylon.logger(
        debug,
        'gamma',
        gamma.gamma.toString(),
        'vab',
        vabLast.toString(),
        'vfb',
        vfbLast.toString(),
        'isLineFormula',
        gamma.isLineFormula,
        'lastPrice',
        avgPrice.toString()
    )
    return {
      gamma: gamma.gamma,
      vab: vabLast,
      vfb: vfbLast,
      isLineFormula: gamma.isLineFormula,
      lastPrice: avgPrice
    }
  }

  private changePairReserveOnFloatSwap(fee: JSBI) {
    if (JSBI.greaterThan(fee, ZERO)) {
      let outputAmount;
      try{
        outputAmount = this.pair.getOutputAmount(new TokenAmount(this.token0, fee))
      }catch (e) {
        return
      }
      // console.log("SDK:: fee", fee.toString(), outputAmount.toString());

      let reserves = this.getPairReserves()
      let isFloatR0 = this.token0.equals(this.pair.token0)
      let ta0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, fee))
      let ta1 = new TokenAmount(this.token1, JSBI.subtract(reserves[1].raw, outputAmount[0].raw))

      this.pair = new Pair(
          isFloatR0 ? ta0 : ta1,
          isFloatR0 ? ta1 : ta0,
          this.pair.lastBlockTimestamp,
          this.pair.liquidityFee
      )
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
        let [pairReserveTranslated] = this.getPairReservesTranslated(ptb, ptt)
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
      reserveTranslated0: JSBI,
      reserveTranslated1: JSBI,
      amountIn: JSBI,
      isAnchor: boolean,
      factory: PylonFactory,
      totalSupply: JSBI,
      debug: boolean = false
  ): SyncAsyncParams {
    Pylon.logger(debug, "Sync and Async", amountIn.toString())
    let reserve = isAnchor ? this.reserve1.raw : this.reserve0.raw
    let maxSync = factory.maxSync
    let max = JSBI.divide(JSBI.multiply(isAnchor ? reserveTranslated1 : reserveTranslated0, maxSync), _100)
    let freeSpace = ZERO
    let syncMint = ZERO
    let amountOut = ZERO
    let trueAmountOut = ZERO

    let max0 = JSBI.divide(JSBI.multiply(reserveTranslated0, maxSync), _200)
    let max1 = JSBI.divide(JSBI.multiply(reserveTranslated1, maxSync), _200)

    let balance0 = JSBI.add(this.reserve0.raw, isAnchor ? ZERO : amountIn)
    let balance1 = JSBI.add(this.reserve1.raw, isAnchor ? amountIn : ZERO)
    Pylon.logger(debug, "aIn0 max0", balance0.toString(), max0.toString())
    Pylon.logger(debug, "aIn1 max1", balance1.toString(), max1.toString())
    if (JSBI.greaterThan(balance0, max0) && JSBI.greaterThan(balance1, max1)) {
      Pylon.logger(debug, "Sync a1 > max0 && a2 > max1")
      let maxes = this.getMaximum(JSBI.subtract(balance0, max0), JSBI.subtract(balance1, max1))
      if (isAnchor) {
        max = JSBI.divide(JSBI.multiply(JSBI.add(reserveTranslated1, maxes.maxY), maxSync), _100)
        syncMint = maxes.maxY
      } else {
        max = JSBI.divide(JSBI.multiply(JSBI.add(reserveTranslated0, maxes.maxX), maxSync), _100)
        syncMint = maxes.maxX
      }
      Pylon.logger(debug, "Sync", "X:", maxes.maxX.toString(), "Y:", maxes.maxY.toString())
      Pylon.logger(debug, "Sync", "max", max.toString(), "syncMint", syncMint.toString())
    }
    // SDK:: Sync X: 12513455785338593 Y: 25024345547006450
    // Maxes::  12500268846416436 25000486448219776

    // SDK:: Sync max 476275704552892833 syncMint 12513455785338593

    if (JSBI.greaterThan(max, reserve)) {
      freeSpace = JSBI.subtract(JSBI.add(max, syncMint), reserve)
      Pylon.logger(debug, "Sync", "freeSpace", freeSpace.toString())
      if (JSBI.greaterThan(freeSpace, ZERO)) {
        if (JSBI.lessThanOrEqual(amountIn, freeSpace)) {
          // sync  mint
          let syncMinting = this.syncMinting(
              reserveTranslated0,
              reserveTranslated1,
              balance0,
              balance1,
              factory,
              totalSupply
          )

          return {
            amountOut: amountIn,
            amountPool: syncMinting.px,
            trueAmountOut: amountIn,
            syncMinting,
            amounts: {sync: amountIn, async: ZERO},
            slippage: ZERO
          }
        } else {
          amountOut = freeSpace
        }
      }
    }

    let asyncToMint = JSBI.subtract(amountIn, freeSpace)
    Pylon.logger(debug, "Async", "asyncToMint", asyncToMint.toString())

    let amountAsyncOut
    let sqrtK = sqrt(JSBI.multiply(reserveTranslated0, reserveTranslated1))
    let amountInWithFee = JSBI.divide(
        JSBI.multiply(
            asyncToMint,
            JSBI.subtract(_10000, JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE))),
        _10000)
    Pylon.logger(debug, "Async", "amountInWithFee", amountInWithFee.toString())

    if (isAnchor) {
      let sqrtKPrime = sqrt(JSBI.multiply(reserveTranslated0, JSBI.add(reserveTranslated1, amountInWithFee)))
      Pylon.logger(debug, "Async", "sqrtKPrime:", sqrtKPrime.toString(), "sqrtK:", sqrtK.toString())
      invariant(JSBI.lessThan(sqrtK, sqrtKPrime), 'ZP: SK')
      let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)
      amountAsyncOut = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, liqPercentage), reserveTranslated1), BASE)
    } else {
      let sqrtKPrime = sqrt(JSBI.multiply(reserveTranslated1, JSBI.add(reserveTranslated0, amountInWithFee)))
      Pylon.logger(debug, "Async", "sqrtKPrime:", sqrtKPrime.toString(), "sqrtK:", sqrtK.toString())
      invariant(JSBI.lessThan(sqrtK, sqrtKPrime), 'ZP: SK')
      let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)
      let liqPercentageAdj = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtKPrime)
      amountAsyncOut = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, liqPercentageAdj), reserveTranslated0), BASE)
      trueAmountOut = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, liqPercentage), reserveTranslated0), BASE)
      Pylon.logger(debug, "Async:: ", "liqPercentage", liqPercentage.toString(), "liqPercentageAdj",
          liqPercentageAdj.toString(), "amountOut:", amountAsyncOut.toString(), "trueAmountOut:", trueAmountOut.toString())
    }

    let slippage = JSBI.multiply(
        JSBI.divide(
            JSBI.multiply(JSBI.subtract(asyncToMint, amountAsyncOut), BASE),
            asyncToMint
        ), _100)

    Pylon.logger(debug, "Slippage on Async:", slippage.toString())

    amountOut = JSBI.add(amountOut, amountAsyncOut)

    let syncMinting = this.syncMinting(
        reserveTranslated0,
        reserveTranslated1,
        balance0,
        balance1,
        factory,
        totalSupply
    )

    return {
      amountOut: amountOut,
      amountPool: JSBI.add(syncMinting.px, trueAmountOut),
      trueAmountOut: JSBI.add(trueAmountOut, freeSpace),
      syncMinting,
      amounts: {sync: freeSpace, async: asyncToMint},
      slippage
    }
  }



  private applyDeltaAndGammaTax(
      amount: JSBI,
      strikeBlock: JSBI,
      blockNumber: JSBI,
      gamma: JSBI,
      pylonFactory: PylonFactory,
      maxDerivative: JSBI,
      isSync: boolean,
      lastPrice: JSBI,
      decimals: Decimals,
      debug: boolean = false
  ): { newAmount: JSBI; fee: JSBI; deltaApplied: boolean; blocked: boolean; asyncBlocked: boolean; feeBPS: JSBI } {
    let instantPrice = JSBI.divide(JSBI.multiply(parseBigintIsh(decimals.float), this.getPairReserves()[1].raw), this.getPairReserves()[0].raw)
    Pylon.logger(debug,'Instant Price =====> ', instantPrice.toString())
    Pylon.logger(debug,'Last Price =====> ', lastPrice.toString())
    let feeByGamma = Library.getFeeByGamma(gamma, pylonFactory.minFee, pylonFactory.maxFee)

    let feeBPS
    if (isSync) {
      feeBPS = feeByGamma
    } else {
      feeBPS = JSBI.multiply(pylonFactory.liquidityFee, TWO)
      if (JSBI.greaterThanOrEqual(instantPrice, lastPrice)) {
        feeBPS = JSBI.add(feeBPS, JSBI.subtract(_10000, JSBI.divide(JSBI.multiply(lastPrice, _10000), instantPrice)))
      } else {
        feeBPS = JSBI.add(feeBPS, JSBI.subtract(_10000, JSBI.divide(JSBI.multiply(instantPrice, _10000), lastPrice)))
      }
    }

    if (JSBI.greaterThanOrEqual(maxDerivative, pylonFactory.deltaGammaThreshold)) {
      Pylon.logger(debug,'maxDerivative > deltaGammaThreshold')

      let strikeDiff = JSBI.subtract(blockNumber, strikeBlock)
      let cooldownBlocks = JSBI.divide(BASE, pylonFactory.deltaGammaThreshold)

      if (JSBI.lessThanOrEqual(strikeDiff, cooldownBlocks)) {
        Pylon.logger(debug, 'strikeDiff < cooldownBlocks')

        feeBPS = JSBI.add(
            JSBI.add(
                JSBI.subtract(JSBI.divide(JSBI.multiply(maxDerivative, _10000), pylonFactory.deltaGammaThreshold), _10000),
                pylonFactory.deltaGammaFee
            ),
            feeBPS
        )
        Pylon.logger(debug, 'feeBPS ===>>>> ', feeBPS.toString(), _10000.toString())

        if (JSBI.greaterThan(feeBPS, _10000)) {
          return {
            newAmount: ZERO,
            fee: ZERO,
            deltaApplied: false,
            blocked: true,
            asyncBlocked: false,
            feeBPS
          }
        } else {
          let fee = JSBI.divide(JSBI.multiply(feeBPS, amount), _10000)
          if (JSBI.lessThanOrEqual(fee, TEN)) fee = ZERO;
          Pylon.logger(debug,'FeeBPS =====> ', feeBPS.toString())
          return {
            newAmount: JSBI.subtract(amount, fee),
            fee,
            deltaApplied: true,
            blocked: false,
            asyncBlocked: false,
            feeBPS
          }
        }
      } else {
        Pylon.logger(debug, 'strikeDiff > cooldownBlocks')
        let fee = JSBI.divide(JSBI.multiply(feeBPS, amount), _10000)
        Pylon.logger(debug, 'feeBPS ===>>>> ', feeBPS.toString())
        if (JSBI.lessThanOrEqual(fee, TEN)) fee = ZERO;

        if (JSBI.greaterThan(feeBPS, _10000)) {
          return {
            newAmount: ZERO,
            fee: ZERO,
            deltaApplied: false,
            blocked: true,
            asyncBlocked: false,
            feeBPS
          }
        }
        Pylon.logger(debug, 'feeBPS ===>>>> ', feeBPS.toString())
        return {
          newAmount: JSBI.subtract(amount, fee),
          fee,
          deltaApplied: false,
          blocked: false,
          asyncBlocked: true,
          feeBPS
        }
      }
    }
    Pylon.logger(debug, 'feeBPS ===>>>> ', feeBPS.toString())
    let fee = JSBI.divide(JSBI.multiply(feeBPS, amount), _10000)
    if (JSBI.lessThanOrEqual(fee, TEN)) fee = ZERO;
    return {
      newAmount: JSBI.subtract(amount, fee),
      fee,
      deltaApplied: false,
      blocked: false,
      asyncBlocked: false,
      feeBPS
    }
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
      isAnchor: boolean,
      debug: boolean
  ): JSBI {
    let pylonShare: JSBI
    let maxPoolTK: JSBI
    let [ptTR0, ptTR1] = this.getPairReservesTranslated(ptb, totalSupply)

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

    Pylon.logger(debug,"CALCULATE LPTU PylonShare: ", pylonShare.toString(), "maxPoolTokens::", maxPoolTK.toString());

    return JSBI.divide(JSBI.multiply(pylonShare, tokenAmount), maxPoolTK)
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
    let [, pairRSTR] = this.getPairReservesTranslated(ptb, ptt)


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
      omegaSlashing: JSBI,
      reserveAnchor: JSBI,
      ts: JSBI
  ): { ptuToAdd: JSBI; slashAmount: JSBI } {
    if (JSBI.lessThan(omegaSlashing, BASE)) {
      let amountToAdd = JSBI.divide(JSBI.multiply(JSBI.subtract(BASE, omegaSlashing), amountPTU), BASE)

      if (JSBI.lessThan(amountToAdd, energyPTBalance)) {
        return { ptuToAdd: amountToAdd, slashAmount: ZERO }
      } else {
        let slashAmount = JSBI.divide(
            JSBI.multiply(
                JSBI.subtract(
                    amountToAdd,
                    energyPTBalance),
                JSBI.multiply(TWO, this.getPairReserves()[1].raw)), ts)

        slashAmount = JSBI.greaterThan(slashAmount, reserveAnchor) ? reserveAnchor : slashAmount
        return { ptuToAdd: energyPTBalance, slashAmount: slashAmount }
      }
    }
    return { ptuToAdd: ZERO, slashAmount: ZERO }
  }

  // public anchorSlash(
  //     stableAmount: JSBI,
  //     floatAmount: JSBI,
  //     extraPercentage: JSBI,
  //     anchorEnergyBalance: JSBI
  // ): { extraStable: JSBI } {
  //   if (JSBI.greaterThan(extraPercentage, ZERO)) {
  //     let totalAmount = JSBI.add(
  //         stableAmount,
  //         JSBI.divide(JSBI.multiply(floatAmount, this.getPairReserves()[1].raw), this.getPairReserves()[0].raw)
  //     )
  //     let originalAmount = JSBI.divide(JSBI.multiply(totalAmount, BASE), JSBI.subtract(BASE, extraPercentage))
  //     let amountToTransfer = JSBI.subtract(originalAmount, totalAmount)
  //     let extraStable = JSBI.greaterThan(amountToTransfer, anchorEnergyBalance) ? anchorEnergyBalance : amountToTransfer
  //     console.log('extraStable', amountToTransfer.toString())
  //     return { extraStable: extraStable }
  //   }
  //   return { extraStable: ZERO }
  // }

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

  // private getDesiredFTV(
  //     adjVAB: JSBI,
  //     change: JSBI,
  //     ptb: JSBI,
  //     totalSupply: JSBI,
  //     p2x: JSBI,
  //     p2y: JSBI,
  //     decimals: Decimals,
  //     isPercentage: boolean
  // ): JSBI {
  //   let [pairTR0, pairTR1] = this.getPairReservesTranslated(ptb, totalSupply)
  //
  //   let desiredFTV = Library.getFTVForX(
  //       JSBI.divide(JSBI.multiply(pairTR1, BASE), pairTR0),
  //       p2x,
  //       p2y,
  //       pairTR0,
  //       pairTR1,
  //       adjVAB
  //   )
  //
  //   if (isPercentage) {
  //     if (JSBI.notEqual(change, BASE)) {
  //       desiredFTV = JSBI.divide(JSBI.multiply(desiredFTV, change), BASE)
  //     }
  //   } else {
  //     desiredFTV = JSBI.add(desiredFTV, change)
  //   }
  //   return desiredFTV
  // }


  private initSync(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      ptb: TokenAmount,
      totalSupply: TokenAmount,
      factory: PylonFactory,
      blockTimestamp: JSBI,
      blockNumber: JSBI,
      debug: boolean = false
  ): {
    kLast: JSBI
    ema: JSBI
    gamma: JSBI
    vab: JSBI
    isLineFormula: boolean
    lastPrice: JSBI
    totalSupply: JSBI
    ptb: JSBI
    p2x: JSBI
    p2y: JSBI
  } {
    Pylon.logger(debug, 'INIT SYNC')
    let ptMinted = this.publicMintFeeCalc(parseBigintIsh(pairInfo.kLast), totalSupply.raw, factory)
    let newTotalSupply = JSBI.add(totalSupply.raw, ptMinted)
    let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(ptb.raw, newTotalSupply)

    let rootK = sqrt(JSBI.multiply(pairReserveTranslated0, pairReserveTranslated1))
    let kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)

    // let updateRemovingExcess = this.updateRemovingExcess(
    //     pairReserveTranslated0,
    //     pairReserveTranslated1,
    //     this.reserve0.raw,
    //     this.reserve1.raw,
    //     factory,
    //     newTotalSupply,
    //     parseBigintIsh(pairInfo.kLast),
    //     debug
    // )
    // let newPTB = JSBI.add(ptb.raw, updateRemovingExcess.liquidity)
    // newTotalSupply = JSBI.add(newTotalSupply, updateRemovingExcess.liquidity)
    // if (JSBI.greaterThan(updateRemovingExcess.liquidity0, ZERO)) {
    //   // Calculating new p2X and p2Y
    //   Pylon.logger(debug, 'CALCULATING NEW P2X AND P2Y removeExcess::liq0 > 0')
    //   let desiredFTV = this.getDesiredFTV(
    //       JSBI.subtract(parseBigintIsh(pylonInfo.virtualAnchorBalance), this.reserve1.raw),
    //       JSBI.divide(JSBI.multiply(updateRemovingExcess.liquidity0, JSBI.multiply(TWO, pairReserveTranslated1)),BASE),
    //       newPTB,
    //       newTotalSupply,
    //       parseBigintIsh(pylonInfo.p2x),
    //       parseBigintIsh(pylonInfo.p2y),
    //       false
    //   )
    //
    //   let newP2 = Library.evaluateP2(
    //       JSBI.divide(JSBI.multiply(pairReserveTranslated1, BASE), pairReserveTranslated0),
    //       JSBI.subtract(parseBigintIsh(pylonInfo.virtualAnchorBalance), this.reserve1.raw),
    //       JSBI.subtract(parseBigintIsh(pylonInfo.virtualFloatBalance), this.reserve0.raw),
    //       pairReserveTranslated0, pairReserveTranslated1, desiredFTV
    //   )
    //   pylonInfo.p2x = newP2.p2x.toString()
    //   pylonInfo.p2y = newP2.p2y.toString()
    // }


    let result = this.updateSync(
        pylonInfo,
        ptb.raw,
        newTotalSupply,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(
            this.token0.equals(this.pair.token0) ? pairInfo.price0CumulativeLast : pairInfo.price1CumulativeLast
        ),
        rootK,
        factory,
        decimals,
        debug
    )


    let ema = Library.calculateEMA(pylonInfo, parseBigintIsh(blockNumber), factory.EMASamples, result.gamma)

    return {
      kLast: kLast,
      ema: ema,
      gamma: result.gamma,
      vab: result.vab,
      isLineFormula: result.isLineFormula,
      lastPrice: result.lastPrice,
      totalSupply: newTotalSupply,
      ptb: ptb.raw,
      p2x: parseBigintIsh(pylonInfo.p2x),
      p2y: parseBigintIsh(pylonInfo.p2y)
    }
  }

  public static logger(debug: boolean, ...args: any[]) {
    if (debug) {
      console.log("SDK::", ...args)
    }
  }

  public mintSync(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      ptTotalSupply: TokenAmount,
      tokenAmount: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      isAnchor: boolean,
      debug: boolean = false
  ): MintSyncParams {
    Pylon.logger(debug, 'Mint Sync: ' + (isAnchor ? "Anchor" : "Float") + " Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())
    const blockedReturn = {
      isDerivedVFB: false,
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      slippage: ZERO,
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      amountsToInvest: { async: ZERO, sync: ZERO }
    }
    if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
      return blockedReturn
    }
    // Doing some checks on the inputs
    invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
    invariant(
        ptTotalSupply.token.equals(isAnchor ? this.anchorLiquidityToken : this.floatLiquidityToken),
        'FLOAT LIQUIDITY'
    )
    invariant(tokenAmount.token.equals(isAnchor ? this.token1 : this.token0), 'TOKEN')

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )

    // TODO: handle skim of excess in case balance of the other token is higher than the reserve

    // Calculating gamma tax and fee
    let fee = this.applyDeltaAndGammaTax(
        tokenAmount.raw,
        parseBigintIsh(pylonInfo.strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        result.ema,
        true,
        result.lastPrice,
        decimals,
        debug
    )
    // If fee is blocked, time to return
    if (fee.blocked) {
      Pylon.logger(debug, 'Mint Sync: Blocked')
      return blockedReturn
    }

    // Changing total supply and pair reserves because when paying float fees we are doing a swap
    if (!isAnchor) this.changePairReserveOnFloatSwap(fee.fee)
    let feePercentage = JSBI.divide(
            JSBI.multiply(
                fee.feeBPS,
                BASE),
        _100) // This is the percentage to show in the UI

    // Calculating Derived VFB
    let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(result.ptb, result.totalSupply)

    let investment = this.handleSyncAndAsync(
        pairReserveTranslated0,
        pairReserveTranslated1,
        fee.newAmount,
        isAnchor,
        factory,
        result.totalSupply,
        debug
    )

    if (investment?.syncMinting?.update) {
      let ptMinted = this.publicMintFeeCalc(parseBigintIsh(pairInfo.kLast), totalSupply.raw, factory)
      result.totalSupply = JSBI.add(result.totalSupply, ptMinted)
    }
    let liquidity;
    if (isAnchor) {
      liquidity = JSBI.divide(JSBI.multiply(investment.amountOut, ptTotalSupply.raw), result.vab)
    } else {
      let floatLiquidityOwned = JSBI.add(
          JSBI.divide(JSBI.multiply(result.ptb, this.reserve0.raw), JSBI.multiply(TWO, pairReserveTranslated0)),
          JSBI.divide(JSBI.multiply(result.ptb, result.gamma), BASE)
      )

      liquidity = JSBI.divide(
          JSBI.multiply(
              ptTotalSupply.raw,
              JSBI.divide(JSBI.multiply(investment.amountOut, result.ptb), JSBI.multiply(TWO, pairReserveTranslated0))
          ),
          floatLiquidityOwned
      )
    }
    return {
      amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
      deltaApplied: fee.deltaApplied,
      amountsToInvest: investment.amounts,
      slippage: investment.slippage,
      feePercentage: feePercentage,
      isDerivedVFB: false
    }
  }

  public mintAsync(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      ptTotalSupply: TokenAmount,
      tokenAmountA: TokenAmount,
      tokenAmountB: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      isAnchor: boolean,
      debug: boolean = false
  ): MintAsyncParams {
    Pylon.logger(debug, 'Mint Async: ' + (isAnchor ? "Anchor" : "Float") + ' ' + tokenAmountA.raw.toString() + ' ' + tokenAmountB.raw.toString()+
        " Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())
    const blockedReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO
    }
    if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
      return blockedReturn
    }
    // Doing some checks on the inputs
    invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
    invariant(
        ptTotalSupply.token.equals(isAnchor ? this.anchorLiquidityToken : this.floatLiquidityToken),
        'FLOAT LIQUIDITY'
    )
    invariant(tokenAmountA.token.equals(this.token0), 'TOKEN')

    // keeping this old value since iss going to come handy to calculate liquidity at the end
    let syncReserve0 = this.reserve0.raw

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )
    // TODO: handle skim of excess in case balance of the other token is higher than the reserve

    // Calculating gamma tax and fee
    // In Mint Async is used just to get the FeeBPS
    let feeA = this.applyDeltaAndGammaTax(
        tokenAmountA.raw,
        parseBigintIsh(pylonInfo.strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        result.ema,
        false,
        result.lastPrice,
        decimals,
        debug
    )
    // If fee is blocked, time to return
    console.log("feeA blocked", feeA.blocked)
    if (feeA.blocked) {
      Pylon.logger(debug, "FTH")
      return blockedReturn
    }
    feeA.fee = JSBI.divide(JSBI.multiply(tokenAmountA.raw, JSBI.multiply(feeA.feeBPS, TWO)), _10000)
    feeA.newAmount = JSBI.subtract(tokenAmountA.raw, feeA.fee)
    // this.changePairReserveOnFloatSwap(feeA.fee)
    let feeB = {
      fee: JSBI.divide(JSBI.multiply(tokenAmountB.raw, JSBI.multiply(feeA.feeBPS, TWO)), _10000),
      newAmount: JSBI.subtract(tokenAmountB.raw, JSBI.divide(JSBI.multiply(tokenAmountB.raw, JSBI.multiply(feeA.feeBPS, TWO)), _10000)),
    }

    Pylon.logger(debug, 'Mint Async: Fee A: ' + feeA.fee.toString(), 'Fee B: ' + feeB.fee.toString())
    Pylon.logger(debug, 'Mint Async: New Amount A: ' + feeA.newAmount.toString(), 'New Amount B: ' + feeB.newAmount.toString())

    if (
        JSBI.lessThan(feeA.newAmount, ZERO) ||
        JSBI.lessThan(feeB.newAmount, ZERO) ||
        JSBI.greaterThan(feeB.fee, JSBI.add(this.reserve1.raw, tokenAmountB.raw))
    ){
      Pylon.logger(debug, "SUB || FTH2");
      return blockedReturn
    }



    // Changing total supply and pair reserves because when paying float fees we are doing a swap
    let feePercentage = JSBI.divide(JSBI.multiply(feeA.feeBPS, BASE), _100) // This is the percentage to show in the UI

    // Calculating Derived VFB
    let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(result.ptb, result.totalSupply)


    let aCase1 = JSBI.divide(
        JSBI.multiply(isAnchor ? feeA.newAmount : feeB.newAmount, JSBI.multiply(TWO, isAnchor ? pairReserveTranslated1 : pairReserveTranslated0)),
        isAnchor ? pairReserveTranslated0 : pairReserveTranslated1
    )

    let aCase2 = JSBI.multiply(isAnchor ? feeB.newAmount : feeA.newAmount, TWO)
    let amount = JSBI.greaterThan(aCase1, aCase2) ? aCase2 : aCase1
    Pylon.logger(debug, 'Amount: ' + amount.toString())
    // Extra liquidity from float extra
    let sqrtK = sqrt(JSBI.multiply(JSBI.add(pairReserveTranslated0, feeA.newAmount), JSBI.add(pairReserveTranslated1, feeB.newAmount)))
    let sqrtKP = sqrt(JSBI.multiply(JSBI.add(pairReserveTranslated0, tokenAmountA.raw), JSBI.add(pairReserveTranslated1, feeB.newAmount)))

    if (JSBI.greaterThan(sqrtKP, sqrtK)) {
      let extra = isAnchor ?  JSBI.multiply(JSBI.add(pairReserveTranslated1, feeB.newAmount), TWO) :
          JSBI.multiply(JSBI.add(pairReserveTranslated0, feeA.newAmount), TWO)
      amount = JSBI.add(amount, JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKP, sqrtK), extra), sqrtK))
    }

    Pylon.logger(debug, 'Amount after extra liquidity from float extra: ' + amount.toString())
    let liquidity;
    if (!isAnchor) {
      let floatLiqOwned = JSBI.add(
          JSBI.divide(JSBI.multiply(syncReserve0, result.ptb), JSBI.multiply(TWO, pairReserveTranslated0)),
          JSBI.divide(JSBI.multiply(result.ptb, result.gamma), BASE)
      )
      Pylon.logger(debug, "SyncRes0:", syncReserve0.toString(), "PTB:", result.ptb.toString())
      Pylon.logger(debug,"pairReserveTranslated0", pairReserveTranslated0.toString(), "gamma:", result.gamma.toString(), "floatLiqOwned:", floatLiqOwned.toString())

      let ptbMax = JSBI.divide(JSBI.multiply(amount, result.ptb), JSBI.multiply(TWO, pairReserveTranslated0))
      Pylon.logger(debug, "ptbMax", ptbMax.toString())
      liquidity = JSBI.divide(JSBI.multiply(ptbMax, ptTotalSupply.raw), floatLiqOwned)
    }else{
      liquidity = JSBI.divide(JSBI.multiply(amount, ptTotalSupply.raw), result.vab)
    }

    // ptb 84150000000000000000
    // 84150000000000000000
    // 1785417725197367980103
    // 1785417725197367980103
    // 2823067064825063627160
    // 1785417725197367980103
    // 447817706268916784
    // 447816972445734949

    return {
      amountOut: new TokenAmount(isAnchor ? this.anchorLiquidityToken : this.floatLiquidityToken, liquidity),
      blocked: false,
      fee: new TokenAmount(isAnchor ? this.anchorLiquidityToken : this.floatLiquidityToken, JSBI.add(feeA.fee, feeB.fee)),
      deltaApplied: feeA.deltaApplied,
      feePercentage: feePercentage
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
      this.pair = new Pair(
          isFloatR0 ? ta0 : ta1,
          isFloatR0 ? ta1 : ta0,
          this.pair.lastBlockTimestamp,
          this.pair.liquidityFee
      )
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
  ): { newReserve0: JSBI; newReserve1: JSBI; liquidity: JSBI; px: JSBI; py: JSBI, update: boolean } {
    let max0 = JSBI.divide(JSBI.multiply(reserveTranslated0, factory.maxSync), _200)
    let max1 = JSBI.divide(JSBI.multiply(reserveTranslated1, factory.maxSync), _200)
    let newReserve0 = balance0
    let newReserve1 = balance1
    let liquidity = ZERO
    let excess0 = ZERO
    let excess1 = ZERO
    let update = false

    if (JSBI.greaterThan(balance0, max0) && JSBI.greaterThan(balance1, max1)) {
      let maximums = this.getMaximum(JSBI.subtract(balance0, max0), JSBI.subtract(balance1, max1))
      excess0 = maximums.maxX
      excess1 = maximums.maxY
      newReserve0 = JSBI.subtract(balance0, excess0)
      newReserve1 = JSBI.subtract(balance1, excess1)
      liquidity = this.mint(excess0, excess1, totalSupply)
    }else{
      update = true
    }

    return { newReserve0: newReserve0, newReserve1: newReserve1, liquidity: liquidity, px: excess0, py: excess1, update }
  }

  // private updateRemovingExcess(
  //     reserveTranslated0: JSBI,
  //     reserveTranslated1: JSBI,
  //     balance0: JSBI,
  //     balance1: JSBI,
  //     factory: PylonFactory,
  //     totalSupply: JSBI,
  //     kLast: JSBI,
  //     debug: boolean = false
  // ): { newReserve0: JSBI; newReserve1: JSBI; liquidity: JSBI; liquidity0: JSBI } {
  //   let update = false
  //   let max0 = JSBI.divide(JSBI.multiply(reserveTranslated0, factory.maxSync), _100)
  //   let max1 = JSBI.divide(JSBI.multiply(reserveTranslated1, factory.maxSync), _100)
  //
  //   let newReserve0;
  //   let newReserve1;
  //   let liquidity = ZERO
  //   let liquidity0 = ZERO
  //   let excess0 = ZERO
  //   let excess1 = ZERO
  //   Pylon.logger(debug, "Update Removing Excess", balance0.toString(), balance1.toString(), max0.toString(), max1.toString())
  //
  //   //84150000000000000000
  //   //178541772519736798010
  //   if (JSBI.greaterThan(balance0, max0)) {
  //     excess0 = JSBI.subtract(balance0, max0)
  //     liquidity = JSBI.add(
  //         liquidity,
  //         this.getOneSideLiquidity(
  //             this.getPairReserves()[0].raw,
  //             this.getPairReserves()[1].raw,
  //             excess0,
  //             factory,
  //             totalSupply
  //         )
  //     )
  //     liquidity0 = liquidity
  //     newReserve0 = max0
  //     Pylon.logger(debug, 'Removed Excess 0: ', excess0, 'Liquidity: ', liquidity)
  //     update = true
  //   } else {
  //     newReserve0 = balance0
  //   }
  //   if (JSBI.greaterThan(balance1, max1)) {
  //     excess1 = JSBI.subtract(balance1, max1)
  //     liquidity = JSBI.add(
  //         liquidity,
  //         this.getOneSideLiquidity(
  //             this.getPairReserves()[1].raw,
  //             this.getPairReserves()[0].raw,
  //             excess1,
  //             factory,
  //             totalSupply
  //         )
  //     )
  //     newReserve1 = max1
  //     Pylon.logger(debug, 'Removed Excess 1: ', excess1, 'Liquidity: ', liquidity)
  //
  //     update = true
  //   } else {
  //     newReserve1 = balance1
  //   }
  //
  //   let ptMinted = ZERO
  //   if (update) {
  //     ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), totalSupply, factory)
  //   }
  //
  //   let reserves = this.getPairReserves()
  //   let ta0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, excess0))
  //   let ta1 = new TokenAmount(this.token1, JSBI.add(reserves[1].raw, excess1))
  //   let isFloatR0 = this.token0.equals(this.pair.token0)
  //
  //   this.pair = new Pair(
  //       isFloatR0 ? ta0 : ta1,
  //       isFloatR0 ? ta1 : ta0,
  //       this.pair.lastBlockTimestamp,
  //       this.pair.liquidityFee
  //   )
  //
  //   this.tokenAmounts = [new TokenAmount(this.token0, newReserve0), new TokenAmount(this.token1, newReserve1)]
  //   return { newReserve0: newReserve0, newReserve1: newReserve1, liquidity: JSBI.add(ptMinted, liquidity), liquidity0: liquidity0 }
  // }


  public burnFloat(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      floatTotalSupply: TokenAmount,
      poolTokensIn: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      debug: boolean = false
  ): BurnParams {
    Pylon.logger(debug, 'Burn Float' +    " Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())
    Pylon.logger(debug, 'Pool tokens IN' + poolTokensIn.raw.toString());

    const blockReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      omegaSlashingPercentage: ZERO,
      slippage: ZERO,
      reservesPTU: ZERO,
      amountWithSlippage: ZERO
    }
    if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
      return blockReturn
    }
    let feePercentage = ZERO

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )

    let pairReserveTranslated0 = this.getPairReservesTranslated(result.ptb, result.totalSupply)[0]

    // BURN
    let reservePTU = JSBI.divide(
        JSBI.multiply(this.reserve0.raw, floatTotalSupply.raw),
        JSBI.add(
            this.reserve0.raw,
            JSBI.divide(JSBI.multiply(JSBI.multiply(pairReserveTranslated0, result.gamma), TWO), BASE)
        )
    )

    Pylon.logger(debug, "Reserves PT:", reservePTU.toString())

    let ptAmount = reservePTU
    if (JSBI.greaterThan(reservePTU, poolTokensIn.raw)) {
      ptAmount = poolTokensIn.raw
    }

    let amountSync = JSBI.divide(
        JSBI.multiply(
            JSBI.add(
                this.reserve0.raw,
                JSBI.divide(JSBI.multiply(pairReserveTranslated0, JSBI.multiply(result.gamma, TWO)), BASE)
            ),
            ptAmount
        ),
        floatTotalSupply.raw
    )

    let fee1 = this.applyDeltaAndGammaTax(
        amountSync,
        parseBigintIsh(pylonInfo.strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        result.ema,
        true,
        result.lastPrice,
        decimals,
        debug
    )


    let amountNofee = amountSync
    let amount = JSBI.subtract(amountSync, JSBI.divide(JSBI.multiply(amountSync, fee1.feeBPS), _10000))
    if (fee1.blocked) {
      Pylon.logger(debug, "FTH");
      return blockReturn
    }
    Pylon.logger(debug, "Sync Amount: ", amount.toString())

    let kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
    let fee = JSBI.subtract(amountNofee, amount)
    // this.tokenAmounts = [new TokenAmount(this.token0, JSBI.subtract(this.reserve0.raw, amount)), new TokenAmount(this.token1, this.reserve1.raw)]

    feePercentage = JSBI.greaterThan(fee1.newAmount, ZERO)
        ? JSBI.multiply(
            JSBI.divide(
                JSBI.multiply(
                    fee,
                    BASE
                ),
                amountNofee),
            _100)
        : ZERO
    let slippage = ZERO
    if (JSBI.lessThan(reservePTU, poolTokensIn.raw)) {
      let adjustedLiq = JSBI.subtract(poolTokensIn.raw, reservePTU)
      let lptu = this.calculateLPTU(
          result.totalSupply,
          floatTotalSupply,
          adjustedLiq,
          result.vab,
          result.gamma,
          result.ptb,
          false,
          debug
      )
      // 44614474520524358468 45638513562644976188
      Pylon.logger(debug, "PTU Burn Async: ", lptu.toString())
      // amount 22451709433978287703 45638513562644976188
      // totalSupply 2806379670533416315512
      // amounts 22451734978656266016 45638461701901183717
      // totalSupply 2806379670932589403398

      // amounts 22451734978656266016 45638461701901183717
      // totalSupply 2806379670932589403398

      // b:totalSupply 2806379670533416315512

      let lptuWithFee = JSBI.subtract(lptu, JSBI.divide(JSBI.multiply(lptu, fee1.feeBPS), _10000))
      let lptuFee = JSBI.subtract(lptu, lptuWithFee)
      // this.changePairReserveOnFloatSwap(fee1.fee)
      // 604705541361411447
      let ptMinted = this.publicMintFeeCalc(parseBigintIsh(kLast), result.totalSupply, factory)
      let newTotalSupply = JSBI.add(result.totalSupply, ptMinted)

      let amount0 = JSBI.divide(JSBI.multiply(lptuWithFee, this.getPairReserves()[0].raw), newTotalSupply)
      let amount1 = JSBI.divide(JSBI.multiply(lptuWithFee, this.getPairReserves()[1].raw), newTotalSupply)


      let newPair = this.pair
      if (
          JSBI.lessThan(amount0, this.getPairReserves()[0].raw) &&
          JSBI.lessThan(amount1, this.getPairReserves()[1].raw)
      ) {
        newPair = new Pair(
            new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
            new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)),
            this.pair.lastBlockTimestamp,
            this.pair.liquidityFee
        )
      }
      let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token1, amount1))
      let amountTransformedComplete = JSBI.divide(
          JSBI.multiply(amount1, this.getPairReserves()[0].raw),
          this.getPairReserves()[1].raw
      )

      let asyncAmount = JSBI.add(amount0, amountTransformed[0].raw)
      amount = JSBI.add(amount, asyncAmount)

      let feeAmount0 = JSBI.divide(JSBI.multiply(lptuFee, this.getPairReserves()[0].raw), newTotalSupply)
      let feeAmount1 = JSBI.divide(JSBI.multiply(lptuFee, this.getPairReserves()[1].raw), newTotalSupply)
      let feeAmountTransformed = JSBI.divide(
          JSBI.multiply(feeAmount1, this.getPairReserves()[0].raw),
          this.getPairReserves()[1].raw
      )
      feePercentage = JSBI.multiply(
          JSBI.divide(
              JSBI.multiply(
                  JSBI.add(
                      fee,
                      JSBI.add(feeAmount0, feeAmountTransformed)
                  ),
                  BASE
              ),
              JSBI.add(amountNofee, asyncAmount)),
          _100
      )
      // 1679547563783431290970 4844730000000000000078
      // 1679547563783431290970 maxPoolTokens:: 4844730000000000000078

      slippage = JSBI.multiply(
          JSBI.divide(
              JSBI.multiply(JSBI.subtract(amountTransformedComplete, amountTransformed[0].raw), BASE),
              asyncAmount),
          _100)
      Pylon.logger(debug, "Async: Slippage: ", slippage.toString() )
    }
    Pylon.logger(debug, "Fee Percentage: ", feePercentage.toString() )

    return {
      amountOut: new TokenAmount(poolTokensIn.token, amount),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, fee),
      deltaApplied: fee1.deltaApplied,
      feePercentage,
      omegaSlashingPercentage: ZERO,
      slippage,
      reservesPTU: reservePTU,
      amountWithSlippage: JSBI.subtract(amount, amountSync)
    }
  }

  public burnAnchor(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      anchorTotalSupply: TokenAmount,
      poolTokensIn: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      reservePTEnergy: TokenAmount,
      reserveAnchorEnergy: TokenAmount,
      debug: boolean = false
  ): BurnParams {
    Pylon.logger(debug, "BURN ANCHOR" + " Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())
    Pylon.logger(debug, "BURN ANCHOR", poolTokensIn.raw.toString())
    const blockReturn = {
      amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
      blocked: true,
      fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
      deltaApplied: true,
      feePercentage: ZERO,
      omegaSlashingPercentage: ZERO,
      slippage: ZERO,
      reservesPTU: ZERO,
      amountWithSlippage: ZERO
    }

    if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
      return blockReturn
    }
    let feePercentage = ZERO
    let omegaSlashingPercentage = ZERO
    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )
    // let pairReserveTranslated0 = Library.translateToPylon(this.getPairReserves()[0].raw, ptb.raw, result.totalSupply)
    let reservePTU = JSBI.divide(JSBI.multiply(this.reserve1.raw, anchorTotalSupply.raw), result.vab)

    let ptAmount = reservePTU
    if (JSBI.greaterThan(reservePTU, poolTokensIn.raw)) {
      ptAmount = poolTokensIn.raw
    }
    let amountSync = JSBI.divide(JSBI.multiply(result.vab, ptAmount), anchorTotalSupply.raw)

    let fee1 = this.applyDeltaAndGammaTax(
        amountSync,
        parseBigintIsh(pylonInfo.strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        result.ema,
        true,
        result.lastPrice,
        decimals,
        debug
    )
    let amountNofee = amountSync
    let amount = JSBI.subtract(amountSync, JSBI.divide(JSBI.multiply(amountSync, fee1.feeBPS), _10000))
    if (fee1.blocked) {
      Pylon.logger(debug, "BURN ANCHOR: FTH")
      return blockReturn
    }
    Pylon.logger(debug, "BURN ANCHOR", "amount", amount.toString())
    // this.tokenAmounts = [new TokenAmount(this.token0, this.reserve0.raw), new TokenAmount(this.token1, JSBI.subtract(this.reserve1.raw, amount))]

    let fee = JSBI.subtract(amountNofee, amount)

    Pylon.logger(debug, "BURN ANCHOR", "fee", fee.toString())

    feePercentage = JSBI.greaterThan(fee1.newAmount, ZERO)
        ? JSBI.multiply(
            JSBI.divide(
                JSBI.multiply(
                    fee,
                    BASE),
                amountNofee),
            _100)
        : ZERO
    let slippage = ZERO

    if (JSBI.lessThan(reservePTU, poolTokensIn.raw)) {
      let adjustedLiq = JSBI.subtract(poolTokensIn.raw, reservePTU)
      // console.log("adjustedLiq", adjustedLiq.toString(10))
      let lptu = this.calculateLPTU(
          result.totalSupply,
          anchorTotalSupply,
          adjustedLiq,
          result.vab,
          result.gamma,
          result.ptb,
          true,
          debug
      )

      Pylon.logger(debug, "PTU Burn Async: ", lptu.toString())

      let totalLPTU = this.calculateLPTU(
          result.totalSupply,
          anchorTotalSupply,
          poolTokensIn.raw,
          result.vab,
          result.gamma,
          result.ptb,
          true,
          debug
      )

      let lptuWithFee = JSBI.subtract(
          lptu, JSBI.divide(
              JSBI.multiply(
                  lptu,
                  fee1.feeBPS
              ),
              _10000)
      )

      let feePtu = JSBI.subtract(lptu, lptuWithFee)

      let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, result.ptb, result.totalSupply, lptuWithFee)

      // let adjustedLiq = JSBI.divide(JSBI.multiply(omega, JSBI.subtract(poolTokensIn.raw, reservesPTU)), BASE);
      // let lptu = this.calculateLPTU(newTotalSupply, anchorTotalSupply, adjustedLiq, result.vab, result.gamma, newPTB, true);
      // let fee = this.applyDeltaAndGammaTax(lptu, parseBigintIsh(strikeBlock), parseBigintIsh(blockNumber), result.gamma, factory, ema);
      let slash = this.slashedTokens(reservePTEnergy.raw, lptuWithFee, omegaPTU.omega, reserveAnchorEnergy.raw, result.totalSupply)
      Pylon.logger(debug, "Omega: ", omegaPTU.omega.toString())
      Pylon.logger(debug, "Slash: ", slash.slashAmount.toString(), " Anchor To Send: ", slash.ptuToAdd.toString())
      let liquidity = omegaPTU.newAmount
      Pylon.logger(debug, "Liquidity: ", liquidity.toString())
      omegaSlashingPercentage = JSBI.subtract(
          JSBI.subtract(BASE, omegaPTU.omega),
          JSBI.divide(JSBI.multiply(slash.ptuToAdd, BASE), totalLPTU)
      )

      let percentageFloatChange = JSBI.divide(
          JSBI.multiply(
              JSBI.subtract(result.ptb, liquidity),
              BASE),
          result.ptb)



      Pylon.logger(debug, "Percentage Float Change:", _97P.toString())

      if (JSBI.lessThan(percentageFloatChange, _97P)) {
        liquidity = JSBI.divide(JSBI.multiply(liquidity, percentageFloatChange), BASE)
      }
      let liqAndOmega = JSBI.add(liquidity, slash.ptuToAdd)

      let amount0 = JSBI.divide(JSBI.multiply(liqAndOmega, this.getPairReserves()[0].raw), result.totalSupply)
      let amount1 = JSBI.divide(JSBI.multiply(liqAndOmega, this.getPairReserves()[1].raw), result.totalSupply)

      let newPair = this.pair
      if (
          JSBI.lessThan(amount0, this.getPairReserves()[0].raw) &&
          JSBI.lessThan(amount1, this.getPairReserves()[1].raw)
      ) {
        newPair = new Pair(
            new TokenAmount(this.getPairReserves()[0].token, JSBI.subtract(this.getPairReserves()[0].raw, amount0)),
            new TokenAmount(this.getPairReserves()[1].token, JSBI.subtract(this.getPairReserves()[1].raw, amount1)),
            this.pair.lastBlockTimestamp,
            this.pair.liquidityFee
        )
      }

      let amountTransformed = newPair.getOutputAmount(new TokenAmount(this.token0, amount0))
      let amountTransformedComplete = JSBI.divide(
          JSBI.multiply(amount0, this.getPairReserves()[1].raw),
          this.getPairReserves()[0].raw
      )

      let asyncAmount = JSBI.add(amount1, amountTransformed[0].raw)
      let asyncAmountComplete = JSBI.add(amount1, amountTransformedComplete)
      amount = JSBI.add(fee1.newAmount, JSBI.add(amount1, amountTransformed[0].raw))
      amount = JSBI.add(amount, slash.slashAmount)


      let feeAmount0 = JSBI.divide(JSBI.multiply(feePtu, this.getPairReserves()[0].raw), result.totalSupply)
      let feeAmount1 = JSBI.divide(JSBI.multiply(feePtu, this.getPairReserves()[1].raw), result.totalSupply)
      let feeAmountTransformed = JSBI.divide(
          JSBI.multiply(feeAmount0, this.getPairReserves()[1].raw),
          this.getPairReserves()[0].raw
      )
      feePercentage = JSBI.multiply(
          JSBI.divide(
              JSBI.multiply(
                  JSBI.add(
                      fee,
                      JSBI.add(feeAmount1, feeAmountTransformed)
                  ), BASE),
              JSBI.add(amountNofee, asyncAmountComplete)
          ),
          _100
      )

      let slashAmountPercentage =
          JSBI.divide(
              JSBI.multiply(slash.slashAmount, BASE),
              amount)

      omegaSlashingPercentage = JSBI.subtract(omegaSlashingPercentage, slashAmountPercentage)

      slippage = JSBI.multiply(
          JSBI.divide(
              JSBI.multiply(JSBI.subtract(amountTransformedComplete, amountTransformed[0].raw), BASE),
              asyncAmount),
          _100)
      Pylon.logger(debug, "Async: Slippage: ", slippage.toString())
    }
    Pylon.logger(debug, "Fee Percentage: ", feePercentage.toString())

    return {
      amountOut: new TokenAmount(poolTokensIn.token, amount),
      blocked: false,
      fee: new TokenAmount(this.anchorLiquidityToken, fee1.fee),
      deltaApplied: fee1.deltaApplied,
      feePercentage,
      omegaSlashingPercentage: JSBI.multiply(omegaSlashingPercentage, _100),
      slippage,
      reservesPTU: reservePTU,
      amountWithSlippage: JSBI.subtract(amount, amountSync)
    }
  }

  public burnAsyncAnchor(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      anchorTotalSupply: TokenAmount,
      amountIn: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      reservePTEnergy: TokenAmount,
      reserveAnchorEnergy: TokenAmount,
      debug: boolean = false
  ): BurnAsyncParams {
    Pylon.logger(debug, "Burn Async Anchor" +    " Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())

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
    if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
      return blockReturn
    }

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )

    let lptu = this.calculateLPTU(
        result.totalSupply,
        anchorTotalSupply,
        amountIn.raw,
        result.vab,
        result.gamma,
        result.ptb,
        true,
        debug
    )
    Pylon.logger(debug, "LPTU::", lptu.toString())
    let fee = this.applyDeltaAndGammaTax(
        lptu,
        parseBigintIsh(pylonInfo.strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        result.ema,
        false,
        result.lastPrice,
        decimals,
        debug
    )
    let maxPoolTokens = JSBI.subtract(
        anchorTotalSupply.raw,
        JSBI.divide(JSBI.multiply(anchorTotalSupply.raw, this.reserve1.raw), result.vab)
    )

    if (JSBI.greaterThan(amountIn.raw, maxPoolTokens)) {
      Pylon.logger(debug, "BLOCKED: amountIn > maxPoolTokens")
      return blockReturn
    }

    if (fee.blocked) {
      Pylon.logger(debug, "FTH")
      return blockReturn
    }

    let ptuWithFee = JSBI.subtract(lptu, JSBI.divide(JSBI.multiply(lptu, fee.feeBPS), _10000))
    Pylon.logger(debug, "PTU With Fee: ", ptuWithFee.toString())
    let feeC = JSBI.subtract(lptu, ptuWithFee)

    let feePercentage = JSBI.greaterThan(ptuWithFee, ZERO)
        ? JSBI.multiply(
            JSBI.divide(
                JSBI.multiply(feeC,
                    BASE
                ),
                ptuWithFee),
            _100)
        : ZERO

    let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, result.ptb, result.totalSupply, ptuWithFee)
    Pylon.logger(debug, "omega", omegaPTU.omega.toString())

    let slash = this.slashedTokens(parseBigintIsh(reservePTEnergy.raw), ptuWithFee, omegaPTU.omega, reserveAnchorEnergy.raw, result.totalSupply)
    Pylon.logger(debug, "amountToAdd", slash.ptuToAdd.toString())

    let liq = JSBI.add(omegaPTU.newAmount, slash.ptuToAdd)
    // let omegaSlashingPercentage = JSBI.multiply(
    //     JSBI.divide(JSBI.multiply(JSBI.subtract(ptuWithFee, liq), BASE), ptuWithFee),
    //     _100
    // )
    let omegaSlashingPercentage = JSBI.subtract(
        JSBI.subtract(BASE, omegaPTU.omega),
        JSBI.divide(JSBI.multiply(slash.ptuToAdd, BASE), lptu),
    )

    Pylon.logger(debug, "omega slash (without slash percentage):", omegaSlashingPercentage.toString())
    Pylon.logger(debug, "omega", omegaPTU.omega.toString())

    let amount0 = JSBI.divide(
        JSBI.multiply(liq, this.getPairReserves()[0].raw),
        result.totalSupply
    )
    let amount1 = JSBI.divide(
        JSBI.multiply(liq, this.getPairReserves()[1].raw),
        result.totalSupply
    )

    let slashPercentage = JSBI.divide(
        JSBI.multiply(slash.slashAmount, BASE),
        JSBI.add(amount1,
            JSBI.divide(
                JSBI.multiply(
                    amount0,
                    this.getPairReserves()[1].raw),
                this.getPairReserves()[0].raw)))

    Pylon.logger(debug, "slashPercentage: ", slashPercentage.toString())
    omegaSlashingPercentage = JSBI.subtract(omegaSlashingPercentage, slashPercentage)
    Pylon.logger(debug, "Fee Percentage: ", feePercentage.toString())

    amount1 = JSBI.add(amount1, slash.slashAmount)
    return {
      amountOut: new TokenAmount(this.token0, amount0),
      amountOut2: new TokenAmount(this.token1, amount1),
      asyncBlocked: fee.asyncBlocked,
      blocked: fee.blocked,
      fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
      deltaApplied: fee.deltaApplied,
      feePercentage,
      omegaSlashingPercentage: JSBI.multiply(omegaSlashingPercentage, _100)
    }
  }

  public burnAsyncFloat(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      floatTotalSupply: TokenAmount,
      amountIn: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      debug: boolean = false
  ): BurnAsyncParams {
    Pylon.logger(debug, "Burn Async Float" +    " Decimals F:", decimals.float.toString(), " A:",decimals.anchor.toString())
    Pylon.logger(debug,  "Amount In:", amountIn.raw.toString())
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

    // 3299686700814222487 5482664313372160359530
    // p3x, p3y 8771943755510230681 26173042803749288218830
    // ( 3299686700814222487 , 5482664313372160359530 ) P3 ( 8771943755510230681 , 26173042803749288218830 )


    // weird case scenario when interface sends lrk = 0
    if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
      return blockedReturn
    }

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber),
        debug
    )
    let pairReserveTranslated0 = this.getPairReservesTranslated(result.ptb, result.totalSupply)[0]

    let lptu = this.calculateLPTU(
        result.totalSupply,
        floatTotalSupply,
        amountIn.raw,
        result.vab,
        result.gamma,
        result.ptb,
        false,
        debug
    )
    let fee = this.applyDeltaAndGammaTax(
        lptu,
        parseBigintIsh(pylonInfo.strikeBlock),
        parseBigintIsh(blockNumber),
        result.gamma,
        factory,
        result.ema,
        false,
        result.lastPrice,
        decimals,
        debug
    )
    //58104264783269400056
    Pylon.logger(debug, "lptu", lptu.toString(), "fee", fee.fee.toString())
    let maxPoolTokens = JSBI.subtract(
        floatTotalSupply.raw,
        JSBI.divide(
            JSBI.multiply(floatTotalSupply.raw, this.reserve0.raw),
            JSBI.add(
                JSBI.divide(JSBI.multiply(JSBI.multiply(pairReserveTranslated0, result.gamma), TWO), BASE),
                this.reserve0.raw
            )
        )
    )
    if (JSBI.greaterThan(amountIn.raw, maxPoolTokens)) {
      return blockedReturn
    }
    if (fee.blocked) {
      Pylon.logger(debug, "FTH")
      return blockedReturn
    }
    let ptuWithFee = JSBI.subtract(lptu, JSBI.divide(JSBI.multiply(lptu, fee.feeBPS), _10000))
    let feeC = JSBI.subtract(lptu, ptuWithFee)
    let feePercentage = JSBI.greaterThan(fee.newAmount, ZERO)
        ? JSBI.multiply(JSBI.divide(JSBI.multiply(feeC, BASE), ptuWithFee), _100)
        : ZERO

    let amount0 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[0].raw), result.totalSupply)
    let amount1 = JSBI.divide(JSBI.multiply(fee.newAmount, this.getPairReserves()[1].raw), result.totalSupply)
    Pylon.logger(debug, "Fee Percentage: ", feePercentage.toString() )
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
  // PS: MPT: 1139805756514832609835 1598871126024709543046

  public getLiquidityValue(
      pylonInfo: PylonInfo,
      pairInfo: PairInfo,
      decimals: Decimals,
      totalSupply: TokenAmount,
      ptTotalSupply: TokenAmount,
      liquidity: TokenAmount,
      ptb: TokenAmount,
      blockNumber: BigintIsh,
      factory: PylonFactory,
      blockTimestamp: BigintIsh,
      isAnchor: boolean,
      debug: boolean = false
  ): [TokenAmount, TokenAmount] {
    // invariant(this.involvesToken(token), 'TOKEN')
    invariant(
        totalSupply.token.equals(this.anchorLiquidityToken) || totalSupply.token.equals(this.floatLiquidityToken),
        'TOTAL_SUPPLY'
    )

    let result = this.initSync(
        pylonInfo,
        pairInfo,
        decimals,
        ptb,
        totalSupply,
        factory,
        parseBigintIsh(blockTimestamp),
        parseBigintIsh(blockNumber)
    )
    let lptu = this.calculateLPTU(
        result.totalSupply,
        ptTotalSupply,
        liquidity.raw,
        result.vab,
        result.gamma,
        result.ptb,
        isAnchor,
        debug
    )

    return [
      this.pair.getLiquidityValue(this.token0, totalSupply, new TokenAmount(this.pair.liquidityToken, lptu)),
      this.pair.getLiquidityValue(this.token1, totalSupply, new TokenAmount(this.pair.liquidityToken, lptu))
    ]
  }
}


//TODO: percentage float change is not needed so there is not big changes in here
// using old burnFloat/burnanchor by now

// public burn(
//     pylonInfo: PylonInfo,
//     pairInfo: PairInfo,
//     totalSupply: TokenAmount,
//     ptTotalSupply: TokenAmount,
//     poolTokensIn: TokenAmount,
//     ptb: TokenAmount,
//     blockNumber: BigintIsh,
//     factory: PylonFactory,
//     blockTimestamp: BigintIsh,
//     reservePTEnergy: TokenAmount,
//     reserveAnchorEnergy: TokenAmount,
//     isAnchor: boolean
// ) : BurnParams {
//   const blockReturn = {
//     amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     blocked: true,
//     fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     deltaApplied: true,
//     feePercentage: ZERO,
//     omegaSlashingPercentage: ZERO,
//     slippage: ZERO,
//     reservesPTU: ZERO
//   }
//   if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
//     return blockReturn
//   }
//
//   let feePercentage = ZERO
//   let omegaSlashingPercentage = ZERO
//
//   let result = this.initSync(
//       pylonInfo,
//       pairInfo,
//       ptb,
//       totalSupply,
//       factory,
//       parseBigintIsh(blockTimestamp),
//       parseBigintIsh(blockNumber)
//   )
//
//   let pairReserveTranslated0 = Library.translateToPylon(this.getPairReserves()[0].raw, result.ptb, result.totalSupply)
//
//   let percentageFloatChange = BASE
//
//   let reservePTU = JSBI.divide(
//       JSBI.multiply(isAnchor ? this.reserve1.raw : this.reserve0.raw, ptTotalSupply.raw),
//       JSBI.add(
//           isAnchor ? this.reserve1.raw : this.reserve0.raw,
//           isAnchor ? result.vab : JSBI.divide(JSBI.multiply(JSBI.multiply(pairReserveTranslated0, result.gamma), TWO), BASE)
//       )
//   )
//
//   let ptAmount = reservePTU
//   if (JSBI.greaterThan(reservePTU, poolTokensIn.raw)) {
//     ptAmount = poolTokensIn.raw
//   }
//
//   let amount = JSBI.divide(
//       JSBI.multiply(
//           JSBI.add(
//               isAnchor ? this.reserve1.raw : this.reserve0.raw,
//               isAnchor ? result.vab : JSBI.divide(JSBI.multiply(pairReserveTranslated0, JSBI.multiply(result.gamma, TWO)), BASE)
//           ),
//           ptAmount
//       ),
//       ptTotalSupply.raw
//   )
//
//   let fee1 = this.applyDeltaAndGammaTax(
//       amount,
//       parseBigintIsh(pylonInfo.strikeBlock),
//       parseBigintIsh(blockNumber),
//       result.gamma,
//       factory,
//       result.ema,
//       true,
//       result.lastPrice
//   )
//   let amountNofee = amount
//   amount = JSBI.subtract(amount, JSBI.divide(JSBI.multiply(amount, fee1.feeBPS), _10000))
//   if (fee1.blocked) {
//     return blockReturn
//   }
//   let kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
//   let fee = JSBI.subtract(amountNofee, amount)
//
//   feePercentage = JSBI.greaterThan(fee1.newAmount, ZERO)
//       ? JSBI.multiply(JSBI.divide(JSBI.multiply(fee, BASE), amountNofee), _100)
//       : ZERO
//   let slippage = ZERO
//
//   if (JSBI.lessThan(reservePTU, poolTokensIn.raw)) {
//     let adjustedLiq = JSBI.subtract(poolTokensIn.raw, reservePTU)
//     let lptu = this.calculateLPTU(
//         result.totalSupply,
//         ptTotalSupply,
//         adjustedLiq,
//         result.vab,
//         result.gamma,
//         result.ptb,
//         isAnchor
//     )
//     let totalLPTU = this.calculateLPTU(
//         result.totalSupply,
//         ptTotalSupply,
//         poolTokensIn.raw,
//         result.vab,
//         result.gamma,
//         result.ptb,
//         isAnchor
//     )
//     let lptuWithFee = JSBI.subtract(lptu, JSBI.divide(JSBI.multiply(lptu, fee1.feeBPS), _10000))
//     let fee = JSBI.subtract(lptu, lptuWithFee)
//     this.changePairReserveOnFloatSwap(fee1.fee)
//
//     let percentageFloatChange;
//
//     if (isAnchor) {
//       percentageFloatChange = JSBI.divide(JSBI.multiply(JSBI.subtract(result.ptb, lptuWithFee), BASE), result.ptb)
//
//       if (JSBI.lessThan(percentageFloatChange, _97P)) {
//         let oldPTU = lptuWithFee
//         lptuWithFee = JSBI.divide(JSBI.multiply(lptuWithFee, percentageFloatChange), BASE)
//         lptu = JSBI.divide(JSBI.multiply(lptu, percentageFloatChange), BASE)
//
//         percentageFloatChange = JSBI.divide(
//             JSBI.subtract(oldPTU, lptuWithFee),
//             JSBI.divide(JSBI.multiply(result.gamma, result.ptb), BASE))
//
//         percentageFloatChange = JSBI.add(percentageFloatChange, BASE)
//       }else{
//         percentageFloatChange = BASE
//       }
//       let omegaPTU = this.getOmegaSlashing(result.gamma, result.vab, result.ptb, result.totalSupply, lptuWithFee)
//       omegaSlashingPercentage = JSBI.multiply(
//           JSBI.divide(JSBI.multiply(JSBI.subtract(lptuWithFee, omegaPTU.newAmount), BASE), totalLPTU),
//           _100
//       )
//       let slash = this.slashedTokens(parseBigintIsh(reservePTEnergy.raw), lptuWithFee, omegaPTU.omega)
//       let liquidity = JSBI.add(omegaPTU.newAmount, slash.ptuToAdd)
//
//
//     }else{
//     }
//   }
//
//
//
// }
// public getFloatSyncLiquidityMinted(
//   pylonInfo: PylonInfo,
//   pairInfo: PairInfo,
//   totalSupply: TokenAmount,
//   floatTotalSupply: TokenAmount,
//   tokenAmount: TokenAmount,
//   ptb: TokenAmount,
//   blockNumber: BigintIsh,
//   factory: PylonFactory,
//   blockTimestamp: BigintIsh
// ): MintSyncParams {
//   const blockedReturn = {
//     isDerivedVFB: false,
//     blocked: true,
//     fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     deltaApplied: true,
//     feePercentage: ZERO,
//     extraSlippagePercentage: ZERO,
//     amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     amountsToInvest: { async: ZERO, sync: ZERO }
//   }
//   if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
//     return blockedReturn
//   }
//   // Doing some checks on the inputs
//   invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
//   invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
//   invariant(tokenAmount.token.equals(this.token0), 'TOKEN')
//
//   let result = this.initSync(
//     pylonInfo,
//     pairInfo,
//     ptb,
//     totalSupply,
//     factory,
//     parseBigintIsh(blockTimestamp),
//     parseBigintIsh(blockNumber)
//   )
//   // TODO: handle skim of excess in case balance of the other token is higher than the reserve
//
//   let fee = this.applyDeltaAndGammaTax(
//     tokenAmount.raw,
//     parseBigintIsh(pylonInfo.strikeBlock),
//     parseBigintIsh(blockNumber),
//     result.gamma,
//     factory,
//     result.ema,
//     true,
//     result.lastPrice
//   )
//   console.log('fee', fee.fee.toString())
//   console.log('fee amount', fee.newAmount.toString())
//
//   // let desiredFtv = Library.de
//
//   // If fee is blocked, time to return
//   if (fee.blocked) {
//     return blockedReturn
//   }
//
//   // Changing total supply and pair reserves because when paying float fees we are doing a swap
//   this.changePairReserveOnFloatSwap(fee.fee)
//   let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount), _100) // This is the percentage to show in the UI
//
//   // Calculating Derived VFB
//   let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(ptb.raw, result.totalSupply)
//
//   // let derVFB = JSBI.add(
//   //     this.reserve0.raw,
//   //     JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, result.gamma), pairReserveTranslated0), BASE)
//   // )
//
//   console.log('gamma', result.gamma.toString())
//   console.log('pairReserveTranslated0', pairReserveTranslated0.toString())
//
//   // let floatLiquidityOwned = JSBI.add(
//   //     JSBI.divide(
//   //         JSBI.multiply(result.ptb, this.reserve0.raw),
//   //         JSBI.multiply(TWO, pairReserveTranslated0)),
//   //     JSBI.divide(
//   //         JSBI.multiply(result.ptb, result.gamma),
//   //         BASE))
//
//   // console.log("floatLiquidityOwned", floatLiquidityOwned.toString())
//   // 25870362562607862005
//   // 25870362604337860903
//
//   // let ptbMax = JSBI.divide(
//   //     JSBI.multiply(fee.newAmount, result.ptb),
//   //     JSBI.multiply(TWO, pairReserveTranslated0))
//
//   let investment = this.handleSyncAndAsync(
//     pairReserveTranslated0,
//     pairReserveTranslated1,
//     this.reserve0.raw,
//     tokenAmount.raw,
//     ZERO,
//     false,
//     factory,
//     result.totalSupply
//   )
//
//   // let amount = ZERO
//   let extraSlippagePercentage = ZERO
//
//   // If we've async minting
//   // This is float anchorK calculation
//   // let anchorKFactor = result.anchorKFactor
//   // if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
//   //   anchorKFactor = this.anchorFactorFloatAdd(
//   //       result.ptb,
//   //       result.totalSupply,
//   //       amountsToInvest.async,
//   //       result.gamma,
//   //       parseBigintIsh(anchorKFactor),
//   //       true
//   //   )
//   //   console.log("anchorKFactor", anchorKFactor.toString())
//   // }
//   //
//   // // amount = JSBI.add(amount, amountsToInvest.sync)
//   // // let adjustedVab = JSBI.subtract(result.vab, this.reserve1.raw)
//   //
//   // let syncMinting = this.syncMinting(
//   //     pairReserveTranslated0,
//   //     pairReserveTranslated1,
//   //     JSBI.add(this.reserve0.raw, fee.newAmount),
//   //     this.reserve1.raw,
//   //     factory,
//   //     result.totalSupply
//   // )
//
//   console.log('SDK:: syncMinting liquidity', syncMinting.liquidity.toString())
//   let newReserve0 = syncMinting.newReserve0
//   let newReserve1 = syncMinting.newReserve1
//   let ptMinted = this.publicMintFeeCalc(parseBigintIsh(result.kLast), result.totalSupply, factory)
//   let kLast = JSBI.multiply(this.getPairReserves()[0].raw, this.getPairReserves()[1].raw)
//   let newTotalSupply = JSBI.add(result.totalSupply, ptMinted)
//
//   let newPTB = JSBI.add(result.ptb, syncMinting.liquidity)
//   newTotalSupply = JSBI.add(newTotalSupply, syncMinting.liquidity)
//
//   let prt = this.getPairReservesTranslated(newPTB, newTotalSupply)
//   pairReserveTranslated0 = prt[0]
//   pairReserveTranslated1 = prt[1]
//
//   let updateRemovingExcess = this.updateRemovingExcess(
//     pairReserveTranslated0,
//     pairReserveTranslated1,
//     newReserve0,
//     newReserve1,
//     factory,
//     newTotalSupply,
//     parseBigintIsh(kLast)
//   )
//
//   console.log(
//     'SDK:: pairRes0New, pairRes1New, fee.newAmount',
//     pairReserveTranslated0.toString(),
//     pairReserveTranslated1.toString(),
//     fee.newAmount.toString()
//   )
//   console.log('SDK:: reserve0New', newReserve0.toString())
//   console.log('SDK:: rem:res', updateRemovingExcess.liquidity.toString())
//
//   newPTB = JSBI.add(newPTB, updateRemovingExcess.liquidity)
//   newTotalSupply = JSBI.add(newTotalSupply, updateRemovingExcess.liquidity)
//   console.log(
//     'SDK:: b:update',
//     this.getPairReserves()[1].raw.toString(),
//     newPTB.toString(),
//     newTotalSupply.toString()
//   )
//   pairReserveTranslated0 = Library.translateToPylon(this.getPairReserves()[0].raw, newPTB, newTotalSupply)
//   pairReserveTranslated1 = Library.translateToPylon(this.getPairReserves()[1].raw, newPTB, newTotalSupply)
//   // 16051039208396446316601 29713596568840393285  3035022567202931309857
//   // 16051039677596299082732 29713641002305508996  3035022611625291373769
//   let adjustedVab = JSBI.subtract(result.vab, newReserve1)
//   let newGamma = Library.calculateGamma(
//     pairReserveTranslated1,
//     parseBigintIsh(anchorKFactor),
//     adjustedVab,
//     result.isLineFormula
//   )
//   console.log('SDK:: newGamma', newGamma.gamma.toString())
//
//   // let slippagePercentage = JSBI.divide(JSBI.multiply(amount, BASE), fee.newAmount)
//
//   let newFloatLiquidity = JSBI.add(
//     JSBI.divide(JSBI.multiply(this.reserve0.raw, newPTB), JSBI.multiply(TWO, pairReserveTranslated0)),
//     JSBI.divide(JSBI.multiply(newPTB, newGamma.gamma), BASE)
//   )
//   console.log('SDK:: newFloatLiquidity', newFloatLiquidity.toString())
//   if (JSBI.lessThan(newFloatLiquidity, floatLiquidityOwned)) {
//     return blockedReturn
//   }
//   if (JSBI.greaterThan(JSBI.subtract(newFloatLiquidity, floatLiquidityOwned), ptbMax)) {
//     return blockedReturn
//   }
//
//   let liquidity = JSBI.divide(
//     JSBI.multiply(
//       floatTotalSupply.raw,
//       JSBI.subtract(JSBI.divide(JSBI.multiply(newFloatLiquidity, BASE), floatLiquidityOwned), BASE)
//     ),
//     BASE
//   )
//
//   if (!JSBI.greaterThan(liquidity, ZERO)) {
//     return {
//       amountsToInvest: { async: ZERO, sync: ZERO },
//       extraSlippagePercentage: ZERO,
//       amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
//       blocked: false,
//       fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
//       deltaApplied: false,
//       feePercentage: ZERO,
//       isDerivedVFB: true
//     }
//   }
//   return {
//     amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
//     blocked: false,
//     fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
//     deltaApplied: fee.deltaApplied,
//     amountsToInvest: amountsToInvest,
//     extraSlippagePercentage: extraSlippagePercentage,
//     feePercentage: feePercentage,
//     isDerivedVFB: false
//   }
// }
// private anchorFactorFloatAdd(
//   ptb: JSBI,
//   totalSupply: JSBI,
//   amount: JSBI,
//   gamma: JSBI,
//   oldK: JSBI,
//   async100: boolean
// ): JSBI {
//   let pairReserveTranslated0 = Library.translateToPylon(this.getPairReserves()[0].raw, ptb, totalSupply)
//   let pairReserveTranslated1 = Library.translateToPylon(this.getPairReserves()[1].raw, ptb, totalSupply)
//
//   let ftv = JSBI.multiply(JSBI.multiply(TWO, gamma), async100 ? pairReserveTranslated0 : pairReserveTranslated1)
//   let amountTR = JSBI.divide(
//     JSBI.multiply(amount, pairReserveTranslated0),
//     JSBI.multiply(TWO, pairReserveTranslated1)
//   )
//
//   let anchorK = JSBI.divide(
//     JSBI.multiply(
//       JSBI.add(pairReserveTranslated0, async100 ? amount : amountTR),
//       JSBI.add(pairReserveTranslated1, async100 ? ZERO : JSBI.divide(amount, TWO))
//     ),
//     JSBI.add(amount, ftv)
//   )
//
//   anchorK = JSBI.divide(JSBI.multiply(anchorK, ftv), pairReserveTranslated1)
//   anchorK = JSBI.divide(JSBI.multiply(anchorK, oldK), pairReserveTranslated0)
//   if (JSBI.greaterThan(anchorK, oldK)) {
//     return oldK
//   }
//   if (JSBI.greaterThan(anchorK, BASE)) {
//     return BASE
//   }
//   return anchorK
// }


// public getAnchorAsyncLiquidityMinted(
//   pylonInfo: PylonInfo,
//   pairInfo: PairInfo,
//   totalSupply: TokenAmount,
//   anchorTotalSupply: TokenAmount,
//   tokenAmountA: TokenAmount,
//   tokenAmountB: TokenAmount,
//   ptb: TokenAmount,
//   blockNumber: BigintIsh,
//   factory: PylonFactory,
//   blockTimestamp: BigintIsh
// ): MintAsyncParams {
//   const blockedReturn = {
//     amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     blocked: true,
//     fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     deltaApplied: true,
//     feePercentage: ZERO
//   }
//
//   if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
//     return blockedReturn
//   }
//
//   invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
//   invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
//   const tokenAmounts = [tokenAmountA, tokenAmountB]
//   invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
//
//   let result = this.initSync(
//     pylonInfo,
//     pairInfo,
//     ptb,
//     totalSupply,
//     factory,
//     parseBigintIsh(blockTimestamp),
//     parseBigintIsh(blockNumber)
//   )
//
//   let fee1 = this.applyDeltaAndGammaTax(
//     tokenAmountA.raw,
//     parseBigintIsh(pylonInfo.strikeBlock),
//     parseBigintIsh(blockNumber),
//     result.gamma,
//     factory,
//     result.ema,
//     false,
//     result.lastPrice
//   )
//
//   let fee2 = this.applyDeltaAndGammaTax(
//     tokenAmountB.raw,
//     parseBigintIsh(pylonInfo.strikeBlock),
//     parseBigintIsh(blockNumber),
//     result.gamma,
//     factory,
//     result.ema,
//     false,
//     result.lastPrice
//   )
//   this.changePairReserveOnFloatSwap(fee1.fee)
//
//   if (fee1.blocked || fee2.blocked) {
//     return blockedReturn
//   }
//   let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(
//     result.ptb,
//     result.totalSupply
//   )
//
//   let aCase1 = JSBI.divide(
//     JSBI.multiply(fee1.newAmount, JSBI.multiply(TWO, pairReserveTranslated1)),
//     pairReserveTranslated0
//   )
//
//   let aCase2 = JSBI.multiply(fee2.newAmount, TWO)
//   let amount = JSBI.greaterThan(aCase1, aCase2) ? aCase2 : aCase1
//
//   let liquidity = JSBI.divide(JSBI.multiply(amount, anchorTotalSupply.raw), result.vab)
//
//   let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(fee1.fee, BASE), fee1.newAmount), _100) // This is the percentage to show in the UI
//
//   if (!JSBI.greaterThan(liquidity, ZERO)) {
//     throw new InsufficientInputAmountError()
//   }
//   return {
//     amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
//     blocked: false,
//     fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
//     deltaApplied: fee1.deltaApplied || fee2.deltaApplied,
//     feePercentage: feePercentage
//   }
// }

// public getFloatAsyncLiquidityMinted(
//   pylonInfo: PylonInfo,
//   pairInfo: PairInfo,
//   totalSupply: TokenAmount,
//   floatTotalSupply: TokenAmount,
//   tokenAmountA: TokenAmount,
//   tokenAmountB: TokenAmount,
//   ptb: TokenAmount,
//   blockNumber: BigintIsh,
//   factory: PylonFactory,
//   blockTimestamp: BigintIsh
// ): MintAsyncParams {
//   const blockedReturn = {
//     amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     blocked: true,
//     fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     deltaApplied: true,
//     feePercentage: ZERO
//   }
//   if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
//     return blockedReturn
//   }
//   invariant(floatTotalSupply.token.equals(this.floatLiquidityToken), 'FLOAT LIQUIDITY')
//   invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
//
//   const tokenAmounts = [tokenAmountA, tokenAmountB]
//   invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')
//
//   let stReserve0 = this.reserve0.raw
//
//   let result = this.initSync(
//     pylonInfo,
//     pairInfo,
//     ptb,
//     totalSupply,
//     factory,
//     parseBigintIsh(blockTimestamp),
//     parseBigintIsh(blockNumber)
//   )
//
//   let fee1 = this.applyDeltaAndGammaTax(
//     tokenAmountA.raw,
//     parseBigintIsh(pylonInfo.strikeBlock),
//     parseBigintIsh(blockNumber),
//     result.gamma,
//     factory,
//     result.ema,
//     false,
//     result.lastPrice
//   )
//   let fee2 = this.applyDeltaAndGammaTax(
//     tokenAmountB.raw,
//     parseBigintIsh(pylonInfo.strikeBlock),
//     parseBigintIsh(blockNumber),
//     result.gamma,
//     factory,
//     result.ema,
//     false,
//     result.lastPrice
//   )
//   this.changePairReserveOnFloatSwap(fee1.fee)
//   if (fee1.blocked || fee2.blocked) {
//     return blockedReturn
//   }
//   let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(fee1.fee, BASE), fee1.newAmount), _100) // This is the percentage to show in the UI
//   let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(
//     result.ptb,
//     result.totalSupply
//   )
//
//   let floatLiqOwned = JSBI.add(
//     JSBI.divide(JSBI.multiply(stReserve0, result.ptb), JSBI.multiply(TWO, pairReserveTranslated0)),
//     JSBI.divide(JSBI.multiply(result.ptb, result.gamma), BASE)
//   )
//
//   let ptbMax = JSBI.divide(JSBI.multiply(fee1.newAmount, result.ptb), pairReserveTranslated0)
//
//   let aCase1 = JSBI.divide(
//     JSBI.multiply(fee2.newAmount, JSBI.multiply(TWO, pairReserveTranslated0)),
//     pairReserveTranslated1
//   )
//
//   let aCase2 = JSBI.multiply(fee1.newAmount, TWO)
//   let amount = JSBI.greaterThan(aCase1, aCase2) ? aCase2 : aCase1
//
//   let anchorKFactor = this.anchorFactorFloatAdd(
//     result.ptb,
//     result.totalSupply,
//     JSBI.divide(JSBI.multiply(amount, pairReserveTranslated1), pairReserveTranslated0),
//     result.gamma,
//     parseBigintIsh(result.anchorKFactor),
//     false
//   )
//
//   //calculate amount added that results in uniPT generation, expressed in float units.
//
//   // let amountA = JSBI.divide(JSBI.multiply(pairReserveTranslated0, JSBI.multiply(fee2.newAmount, TWO)), pairReserveTranslated1);
//   // let amountB = JSBI.multiply(fee1.newAmount, TWO);
//   // //let finalAmount = JSBI.greaterThan(amountA, amountB) ? amountB: amountA;
//
//   //console.log("SDK:: amountA, amountB", amountA.toString(), amountB.toString());
//
//   //now we need to calculate new reserves + new gamma
//
//   // This blocks of operations simulates a Normal Mint
//   let poolAddedLiquidity = JSBI.divide(JSBI.multiply(fee1.newAmount, totalSupply.raw), this.getPairReserves()[0].raw)
//   let secondPoolLiq = JSBI.divide(JSBI.multiply(fee2.newAmount, totalSupply.raw), this.getPairReserves()[1].raw)
//   poolAddedLiquidity = JSBI.greaterThan(poolAddedLiquidity, secondPoolLiq) ? secondPoolLiq : poolAddedLiquidity
//   let newTotalSupply = JSBI.add(result.totalSupply, poolAddedLiquidity)
//   let newPtb = JSBI.add(result.ptb, poolAddedLiquidity)
//   //adding amounts to reserves in memory
//   let reserves = this.getPairReserves()
//   let isFloatR0 = this.token0.equals(this.pair.token0)
//   let newPairReserve0 = new TokenAmount(this.token0, JSBI.add(reserves[0].raw, fee1.newAmount))
//   let newPairReserve1 = new TokenAmount(this.token1, JSBI.add(reserves[1].raw, fee2.newAmount))
//   this.pair = new Pair(
//     isFloatR0 ? newPairReserve0 : newPairReserve1,
//     isFloatR0 ? newPairReserve1 : newPairReserve0,
//     this.pair.lastBlockTimestamp,
//     this.pair.liquidityFee
//   )
//
//   //TODO: check if we need an extra remove excess here
//   let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(
//     result.ptb,
//     result.totalSupply
//   )
//
//   let adjustedVab = JSBI.subtract(result.vab, this.reserve1.raw)
//   let newGamma = Library.calculateGamma(
//     pairReserveTranslated1,
//     parseBigintIsh(anchorKFactor),
//     adjustedVab,
//     result.isLineFormula
//   )
//
//   let newFloatLiquidity = JSBI.add(
//     JSBI.divide(JSBI.multiply(this.reserve0.raw, newPtb), JSBI.multiply(TWO, pairReserveTranslated0)),
//     JSBI.divide(JSBI.multiply(newPtb, newGamma.gamma), BASE)
//   )
//
//   if (JSBI.lessThan(newFloatLiquidity, floatLiqOwned)) {
//     return blockedReturn
//   }
//   if (JSBI.greaterThan(JSBI.subtract(newFloatLiquidity, floatLiqOwned), ptbMax)) {
//     return blockedReturn
//   }
//
//   let liquidity = JSBI.divide(
//     JSBI.multiply(
//       floatTotalSupply.raw,
//       JSBI.subtract(JSBI.divide(JSBI.multiply(newFloatLiquidity, BASE), floatLiqOwned), BASE)
//     ),
//     BASE
//   )
//
//   console.log('SDK:: liquidity', liquidity.toString())
//   //let liquidity = this.getLiquidityFromPoolTokensLiquidity(fee1.newAmount, fee2.newAmount, newTotalSupply, ptb.raw, floatTotalSupply, false, result.vab, result.gamma)
//   // let feeLiquidity = this.getLiquidityFromPoolTokensLiquidity(
//   //     fee1.fee,
//   //     fee2.fee,
//   //     newTotalSupply,
//   //     newPTB,
//   //     floatTotalSupply,
//   //     false,
//   //     result.vab,
//   //     result.gamma
//   // )
//   // let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(feeLiquidity, BASE), liquidity), _100)
//
//   if (!JSBI.greaterThan(liquidity, ZERO)) {
//     throw new InsufficientInputAmountError()
//   }
//
//   return {
//     amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
//     blocked: false,
//     fee: new TokenAmount(this.anchorLiquidityToken, JSBI.add(fee1.fee, fee2.fee)),
//     deltaApplied: fee1.deltaApplied || fee2.deltaApplied,
//     feePercentage: feePercentage
//   }
// }

// public getAnchorSyncLiquidityMinted(
//   pylonInfo: PylonInfo,
//   pairInfo: PairInfo,
//   totalSupply: TokenAmount,
//   anchorTotalSupply: TokenAmount,
//   tokenAmount: TokenAmount,
//   ptb: TokenAmount,
//   blockNumber: BigintIsh,
//   factory: PylonFactory,
//   blockTimestamp: BigintIsh
// ): MintSyncParams {
//   const blockedReturn = {
//     isDerivedVFB: false,
//     blocked: true,
//     fee: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     deltaApplied: true,
//     feePercentage: ZERO,
//     extraSlippagePercentage: ZERO,
//     amountOut: new TokenAmount(this.anchorLiquidityToken, ZERO),
//     amountsToInvest: { async: ZERO, sync: ZERO }
//   }
//
//   if (JSBI.equal(parseBigintIsh(pylonInfo.lastRootKTranslated), ZERO)) {
//     return blockedReturn
//   }
//   invariant(anchorTotalSupply.token.equals(this.anchorLiquidityToken), 'ANCHOR LIQUIDITY')
//   invariant(totalSupply.token.equals(this.pair.liquidityToken), 'LIQUIDITY')
//   invariant(tokenAmount.token.equals(this.token1), 'TOKEN')
//
//   let result = this.initSync(
//     pylonInfo,
//     pairInfo,
//     ptb,
//     totalSupply,
//     factory,
//     parseBigintIsh(blockTimestamp),
//     parseBigintIsh(blockNumber)
//   )
//   // TODO: handle skim of excess in case balance of the other token is higher than the reserve
//   let fee = this.applyDeltaAndGammaTax(
//     tokenAmount.raw,
//     parseBigintIsh(pylonInfo.strikeBlock),
//     parseBigintIsh(blockNumber),
//     result.gamma,
//     factory,
//     result.ema,
//     true,
//     result.lastPrice
//   )
//
//   if (fee.blocked) {
//     return blockedReturn
//   }
//
//   let feePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(fee.fee, BASE), fee.newAmount), _100)
//   let [, pairReserveTranslated] = this.getPairReservesTranslated(result.ptb, result.totalSupply)
//
//   let amountsToInvest = this.handleSyncAndAsync(
//     factory.maxSync,
//     pairReserveTranslated,
//     this.reserve1.raw,
//     fee.newAmount
//   )
//   let extraSlippagePercentage = ZERO
//   let amount = ZERO
//
//   if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
//     let [pairReserveTranslated0, pairReserveTranslated1] = this.getPairReservesTranslated(
//       result.ptb,
//       result.totalSupply
//     )
//     let sqrtK = sqrt(JSBI.multiply(pairReserveTranslated0, pairReserveTranslated1))
//
//     let amounInWithFee = JSBI.divide(
//       JSBI.multiply(
//         amountsToInvest.async,
//         JSBI.subtract(_10000, JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE))
//       ),
//       _10000
//     )
//
//     let sqrtKPrime = sqrt(JSBI.multiply(JSBI.add(pairReserveTranslated1, amounInWithFee), pairReserveTranslated0))
//     //7175424315084004299
//     //7211387720175460098
//     let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)
//     amount = JSBI.divide(JSBI.multiply(JSBI.multiply(TWO, liqPercentage), pairReserveTranslated1), BASE)
//     extraSlippagePercentage = JSBI.multiply(
//       JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amount), BASE), amountsToInvest.async),
//       _100
//     )
//     //99423059133275237
//     // anchorKFactor = this.calculateAnchorFactor(
//     //     isLineFormula,
//     //     amount,
//     //     parseBigintIsh(anchorKFactor),
//     //     JSBI.subtract(result.vab, this.reserve1.raw),
//     //     pairReserveTranslated0,
//     //     pairReserveTranslated1,
//     // )
//   }
//
//   // if (JSBI.greaterThan(amountsToInvest.async, ZERO)) {
//   //
//   //   let pairReserveTranslated0 = Library.translateToPylon(this.getPairReserves()[0].raw, ptb.raw, newTotalSupply)
//   //   let pairReserveTranslated1 = Library.translateToPylon(this.getPairReserves()[1].raw, ptb.raw, newTotalSupply)
//   //
//   //   let sqrtK = sqrt(JSBI.multiply(pairReserveTranslated0, pairReserveTranslated1))
//   //   let amounInWithFee = JSBI.divide(
//   //       JSBI.multiply(
//   //           amountsToInvest.async,
//   //           JSBI.subtract(_10000, JSBI.add(JSBI.divide(factory.liquidityFee, TWO), ONE))
//   //       ),
//   //       _10000
//   //   )
//   //   // extraSlippagePercentage = JSBI.multiply(JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amounInWithFee), BASE), amountsToInvest.async), _100);
//   //   let sqrtKPrime = sqrt(
//   //       JSBI.multiply(JSBI.add(pairReserveTranslated1, amounInWithFee), pairReserveTranslated0)
//   //   )
//   //   if (JSBI.greaterThan(sqrtKPrime, sqrtK)) {
//   //     return blockedReturn
//   //   }
//   //   let liqPercentage = JSBI.divide(JSBI.multiply(JSBI.subtract(sqrtKPrime, sqrtK), BASE), sqrtK)
//   //   amount = JSBI.divide(JSBI.multiply(JSBI.multiply(liqPercentage, TWO), pairReserveTranslated1), BASE)
//   //   extraSlippagePercentage = JSBI.multiply(
//   //       JSBI.divide(JSBI.multiply(JSBI.subtract(amountsToInvest.async, amount), BASE), amountsToInvest.async),
//   //       _100
//   //   )
//   // }
//   //14212663367574706618
//   //7141433865249083198
//   amount = JSBI.add(amount, amountsToInvest.sync)
//
//   let liquidity: JSBI = JSBI.divide(JSBI.multiply(amount, anchorTotalSupply.raw), result.vab)
//   if (!JSBI.greaterThan(liquidity, ZERO)) {
//     throw new InsufficientInputAmountError()
//   }
//   return {
//     amountOut: new TokenAmount(this.anchorLiquidityToken, liquidity),
//     blocked: false,
//     fee: new TokenAmount(this.anchorLiquidityToken, fee.fee),
//     deltaApplied: fee.deltaApplied,
//     amountsToInvest: amountsToInvest,
//     extraSlippagePercentage: extraSlippagePercentage,
//     feePercentage: feePercentage,
//     isDerivedVFB: false
//   }
// }



// private calculatePTUToAmount(
//     totalSupply: JSBI,
//     floatTotalSupply: TokenAmount,
//     tokenAmount: TokenAmount,
//     anchorVirtualBalance: JSBI,
//     ptb: JSBI,
//     gamma: JSBI,
//     isAnchor: boolean
// ): JSBI {
//   if (isAnchor) {
//     return JSBI.divide(JSBI.multiply(anchorVirtualBalance, tokenAmount.raw), floatTotalSupply.raw)
//   } else {
//     //(((_reserve0.mul(_gamma).mul(2)/1e18).add(_reservePylon0)).mul(_ptuAmount))/_totalSupply
//     return JSBI.divide(
//         JSBI.multiply(
//             JSBI.add(
//                 JSBI.divide(
//                     JSBI.multiply(
//                         JSBI.multiply(JSBI.divide(JSBI.multiply(this.getPairReserves()[0].raw, ptb), totalSupply), gamma),
//                         TWO
//                     ),
//                     BASE
//                 ),
//                 this.reserve0.raw
//             ),
//             tokenAmount.raw
//         ),
//         floatTotalSupply.raw
//     )
//   }
// }

// private calculateAnchorFactor(
//     isLineFormula: boolean,
//     amount: JSBI,
//     oldKFactor: JSBI,
//     adjVAB: JSBI,
//     resTR0: JSBI,
//     resTR1: JSBI
// ): JSBI {
//   let sqrtKFactor = sqrt(
//       JSBI.multiply(JSBI.subtract(JSBI.divide(JSBI.exponentiate(oldKFactor, TWO), BASE), oldKFactor), BASE)
//   )
//   let vabFactor = JSBI.lessThan(sqrtKFactor, oldKFactor)
//       ? JSBI.subtract(oldKFactor, sqrtKFactor)
//       : JSBI.add(oldKFactor, sqrtKFactor)
//   let amountTres = JSBI.divide(JSBI.multiply(resTR1, DOUBLE_BASE), JSBI.multiply(adjVAB, vabFactor))
//
//   if (isLineFormula || JSBI.greaterThanOrEqual(amountTres, BASE)) {
//     if (
//         !isLineFormula &&
//         JSBI.lessThan(JSBI.add(BASE, JSBI.divide(JSBI.multiply(amount, BASE), adjVAB)), amountTres)
//     ) {
//       return oldKFactor
//     }
//
//     let initialHalfK = isLineFormula ? resTR0 : JSBI.add(
//         resTR0,
//         JSBI.multiply(
//             JSBI.divide(JSBI.multiply(JSBI.subtract(amountTres, BASE), adjVAB), TWO),
//             JSBI.divide(resTR0, resTR1)
//         )
//     )
//     let initialTailK = isLineFormula ? resTR1 : JSBI.add(resTR1, JSBI.divide(JSBI.multiply(JSBI.subtract(amountTres, BASE), adjVAB), JSBI.multiply(BASE, TWO)))
//
//     let initialVAB = isLineFormula ? adjVAB : JSBI.divide(JSBI.multiply(amountTres, adjVAB), BASE)
//
//     let kPrime = JSBI.divide(JSBI.multiply(
//         JSBI.add(resTR0, JSBI.divide(JSBI.multiply(amount, resTR0), JSBI.multiply(TWO, resTR1))),
//         JSBI.add(resTR1, JSBI.divide(amount, TWO))
//     ), initialHalfK)
//
//     let anchorKFac = JSBI.divide(JSBI.multiply(kPrime, initialVAB), initialTailK)
//     anchorKFac = JSBI.divide(JSBI.multiply(anchorKFac, oldKFactor), JSBI.add(adjVAB, amount))
//
//     return JSBI.lessThan(anchorKFac, BASE) ? BASE : anchorKFac
//   } else {
//     return oldKFactor
//   }
// }

// private getLiquidityFromPoolTokensLiquidity(
//     tokenAmountA: JSBI,
//     tokenAmountB: JSBI,
//     totalSupply: JSBI,
//     ptb: JSBI,
//     ptTotalSupply: TokenAmount,
//     isAnchor: boolean,
//     anchorVirtualBalance?: JSBI,
//     gamma?: JSBI
// ): JSBI {
//   let amount: JSBI
//
//   let pairReserveTranslated0 = Library.translateToPylon(this.getPairReserves()[0].raw, ptb, totalSupply)
//   let pairReserveTranslated1 = Library.translateToPylon(this.getPairReserves()[1].raw, ptb, totalSupply)
//   if (isAnchor) {
//     let amountA = JSBI.divide(
//         JSBI.multiply(pairReserveTranslated1, JSBI.multiply(tokenAmountA, TWO)),
//         pairReserveTranslated0
//     )
//     let amountB = JSBI.multiply(tokenAmountB, TWO)
//     amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA
//   } else {
//     // changing values on reserves because fees are swapped only on float changing the reserve
//     // just for precision purposes
//     let amountA = JSBI.divide(
//         JSBI.multiply(pairReserveTranslated0, JSBI.multiply(tokenAmountB, TWO)),
//         pairReserveTranslated1
//     )
//     let amountB = JSBI.multiply(tokenAmountA, TWO)
//     amount = JSBI.greaterThan(amountA, amountB) ? amountB : amountA
//   }
//
//   return this.calculatePTU(isAnchor, amount, totalSupply, ptb, ptTotalSupply, anchorVirtualBalance, gamma)
// }
