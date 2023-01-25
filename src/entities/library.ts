import JSBI from 'jsbi'
import {_1001, _1E3, _42E45, BASE, DOUBLE_BASE, ONE, TEN, TWO, ZERO} from '../constants'
import {parseBigintIsh, sqrt} from '../utils'
import {Decimals, PylonInfo} from "interfaces/pylonInterface";
import {Pylon} from "../entities";
interface Coefficients {a: JSBI; b: JSBI; isANegative: boolean, isBNegative: boolean}
export abstract class Library {
  public static getFTVForX(x: JSBI, p2x: JSBI, p2y: JSBI, reserve0: JSBI, reserve1: JSBI, adjVAB: JSBI, decimals: Decimals): { ftv: JSBI, reduceOnly: boolean, isLineFormula: boolean } {
    let ftv = ZERO

    let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), reserve1)
    p3x = JSBI.divide(JSBI.multiply(p3x, parseBigintIsh(decimals.float)), reserve0)

    if (JSBI.greaterThanOrEqual(x, p3x)) {
      ftv = JSBI.subtract(JSBI.multiply(TWO, sqrt(JSBI.multiply(JSBI.divide(JSBI.multiply(reserve0, reserve1), parseBigintIsh(decimals.float)), x))), adjVAB)
      return {ftv, isLineFormula: false, reduceOnly: false}
    } else {
      let coefficients = this.calculateParabolaCoefficients(p2x, p2y, p3x, adjVAB, decimals, false)
      console.log("coeff", coefficients.a.toString(), coefficients.b.toString(), coefficients.isANegative, coefficients.isBNegative);
      if (coefficients.isBNegative && JSBI.lessThanOrEqual(x, p2x)){
        ftv = JSBI.divide(
            JSBI.multiply(x, p2y),
            p2x)
        return {ftv, isLineFormula: true, reduceOnly: false}
      }
      ftv = this.getFTV(coefficients, x, decimals)
      if (
          !coefficients.isANegative ||
          JSBI.greaterThan(coefficients.b, JSBI.divide(JSBI.multiply(TWO, JSBI.multiply(coefficients.a, p3x)), parseBigintIsh(decimals.anchor)))
      ) {
        return {ftv, isLineFormula: true, reduceOnly: false}
      } else {
        return {ftv, isLineFormula: true, reduceOnly: true}
      }
    }
  }

  // Parabola coefficients calculations
  public static calculateP2(k: JSBI, vab: JSBI, vfb: JSBI, decimals: Decimals): { p2x: JSBI; p2y: JSBI } {
    let p2y = JSBI.subtract(JSBI.divide(JSBI.multiply(k, TWO), vfb), vab)
    return {
      p2x: JSBI.divide(JSBI.multiply(p2y, parseBigintIsh(decimals.float)), vfb),
      p2y
    }
  }

  public static evaluateP2(
      x: JSBI,
      adjVAB: JSBI,
      adjVFB: JSBI,
      res0: JSBI,
      res1: JSBI,
      desiredFTV: JSBI,
      decimals: Decimals
  ): { p2x: JSBI; p2y: JSBI } {
    let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), res1)
    p3x = JSBI.divide(JSBI.multiply(p3x, parseBigintIsh(decimals.float)), res0)

    if (JSBI.lessThan(x, p3x)) {
      return {
        p2x: x,
        p2y: desiredFTV
      }
    } else {
      return this.calculateP2(JSBI.multiply(res0, res1), adjVAB, adjVFB, decimals)
    }
  }

  public static calculateParabolaCoefficients(
      p2x: JSBI,
      p2y: JSBI,
      p3x: JSBI,
      p3y: JSBI,
      decimals: Decimals,
      check: boolean
  ): Coefficients {
    console.log('P2 (', p2x.toString(), ',', p2y.toString(), ')' + ' P3 (', p3x.toString(), ',', p3y.toString(), ')')
    let _1001P = JSBI.multiply(_1001, JSBI.divide(parseBigintIsh(decimals.anchor), _1E3))
    if(JSBI.lessThanOrEqual(JSBI.divide(JSBI.multiply(p3x, parseBigintIsh(decimals.anchor)), p2x), _1001P)) {
      return { a: ZERO, b: JSBI.divide(JSBI.multiply(p3y, parseBigintIsh(decimals.anchor)), p3x), isANegative: false, isBNegative: false }
    }

    if (JSBI.lessThan(p3x, p2x)) {
      if (!check) {
        throw new Error('p3x < p2x')
      } else {
        return { a: _42E45, b: _42E45, isANegative: false, isBNegative: false }
      }
    }

    let a = ZERO
    let b = ZERO
    let isANegative = false

    let aPartial1 = JSBI.multiply(p3y, p2x)
    let aPartial2 = JSBI.multiply(p2y, p3x)
    let aDenominator = JSBI.divide(JSBI.multiply(JSBI.subtract(p3x, p2x), p3x), parseBigintIsh(decimals.anchor))

    if (JSBI.greaterThanOrEqual(aPartial1, aPartial2)) {
      let aNumerator = JSBI.divide(JSBI.subtract(aPartial1, aPartial2), p2x)
      a = JSBI.divide(JSBI.multiply(aNumerator, parseBigintIsh(decimals.anchor)), aDenominator)
      if (
          JSBI.greaterThanOrEqual(JSBI.divide(JSBI.multiply(parseBigintIsh(decimals.anchor), p2y), p2x), JSBI.divide(JSBI.multiply(a, p2x), parseBigintIsh(decimals.anchor)))
      ) {
        b = JSBI.subtract(JSBI.divide(JSBI.multiply(parseBigintIsh(decimals.anchor), p2y), p2x), JSBI.divide(JSBI.multiply(a, p2x), parseBigintIsh(decimals.anchor)))
        return {a, b, isANegative: false, isBNegative: true}
      }else{
        b = JSBI.subtract(
            JSBI.divide(JSBI.multiply(a, p2x), parseBigintIsh(decimals.anchor)),
            JSBI.divide(JSBI.multiply(parseBigintIsh(decimals.anchor), p2y), p2x)
        )
      }
      isANegative = false
    } else {
      let aNumerator = JSBI.divide(JSBI.subtract(aPartial2, aPartial1), p2x)
      a = JSBI.divide(JSBI.multiply(aNumerator, parseBigintIsh(decimals.anchor)), aDenominator)
      b = JSBI.add(JSBI.divide(JSBI.multiply(parseBigintIsh(decimals.anchor), p2y), p2x), JSBI.divide(JSBI.multiply(a, p2x), parseBigintIsh(decimals.anchor)))
      isANegative = true
    }

    return { a, b, isANegative, isBNegative: false }
  }


  public static getFTV(coefficients: Coefficients, x: JSBI, decimals: Decimals) {
    let bCoeff = JSBI.multiply(coefficients.b, x)
    let aCoeff = JSBI.multiply(JSBI.divide(JSBI.multiply(coefficients.a, x), parseBigintIsh(decimals.anchor)), x)
    return JSBI.divide(
        coefficients.isANegative
            ? JSBI.subtract(
                bCoeff,
                aCoeff
            )
            : coefficients.isBNegative ?
                JSBI.subtract(
                    aCoeff,
                    bCoeff
                ) : JSBI.add(
                    bCoeff,
                    aCoeff
                ), parseBigintIsh(decimals.anchor))
  }

  public static calculateGamma(
      resTR0: JSBI,
      resTR1: JSBI,
      adjVAB: JSBI,
      p2x: JSBI,
      p2y: JSBI,
      decimals: Decimals,
      debug: boolean = false
  ): { gamma: JSBI; ftv: JSBI, isLineFormula: boolean, reduceOnly: boolean } {
    Pylon.logger(debug, 'CALCULATE GAMMA')
    // let tpva = JSBI.multiply(resTR1, TWO)

    // let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), resTR0)
    // p3x = JSBI.divide(JSBI.multiply(p3x, BASE), resTR1)
    // Pylon.logger(debug, 'P2 (', p2x.toString(), ',', p2y.toString(), ')' + ' P3 (', p3x.toString(), ',', adjVAB.toString(), ')')
    let x = JSBI.divide(JSBI.multiply(resTR1, parseBigintIsh(decimals.float)), resTR0)
    Pylon.logger(debug, 'x::', x.toString())
    let ftvObject = this.getFTVForX(
        x,
        p2x,
        p2y,
        resTR0,
        resTR1,
        adjVAB,
        decimals
    )
    let gamma = JSBI.divide(
        JSBI.multiply(ftvObject.ftv, BASE),
        JSBI.multiply(resTR1, TWO))
    Pylon.logger(debug, "ftv:: ", ftvObject.ftv.toString(), resTR1.toString())

    // TODO: linear when b neg
    // if (JSBI.greaterThanOrEqual(x, p3x)) {
    //   Pylon.logger(debug, 'x over p3x')
    //   gamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(adjVAB, BASE), tpva))
    //   formulaSwitch = false
    // } else {
    //   let coefficients = Library.calculateParabolaCoefficients(p2x, p2y, p3x, adjVAB, false)
    //   Pylon.logger(debug, 'a', coefficients.a.toString(), 'b', coefficients.b.toString())
    //   if (
    //       !coefficients.isANegative ||
    //       JSBI.greaterThan(coefficients.b, JSBI.divide(JSBI.multiply(TWO, JSBI.multiply(coefficients.a, p3x)), BASE))
    //   ) {
    //     let ftv = this.getFTV(coefficients, x)
    //     Pylon.logger(debug, 'x under p3x =>', 'ftv: ', ftv.toString())
    //     gamma = JSBI.divide(JSBI.multiply(ftv, BASE), tpva)
    //     formulaSwitch = true
    //   } else {
    //     throw new Error('Float Error')
    //   }
    // }
    return { ...ftvObject, gamma }

  }

  public static translateToPylon(toTranslate: JSBI, ptb: JSBI, ptt: JSBI) {
    return JSBI.divide(JSBI.multiply(toTranslate, ptb), ptt)
  }

  public static calculateEMA(pylonInfo: PylonInfo, currentBlockNumber: JSBI, EMASamples: JSBI, gamma: JSBI): JSBI {
    // Calculating Total Pool Value Anchor Prime
    let oldGamma = parseBigintIsh(pylonInfo.gammaMulDecimals)
    let blockDiff = JSBI.subtract(currentBlockNumber, parseBigintIsh(pylonInfo.EMABlockNumber))
    if (JSBI.equal(blockDiff, ZERO)) {
      let blockEMA: JSBI
      if (JSBI.greaterThan(gamma, oldGamma)) {
        blockEMA = JSBI.subtract(gamma, oldGamma)
      } else {
        blockEMA = JSBI.subtract(oldGamma, gamma)
      }

      blockEMA = JSBI.add(parseBigintIsh(pylonInfo.thisBlockEMA), blockEMA)
      if (JSBI.greaterThan(parseBigintIsh(pylonInfo.gammaEMA), blockEMA)) {
        return parseBigintIsh(pylonInfo.gammaEMA)
      } else {
        return blockEMA
      }
    } else {
      let bleed = ZERO
      if (JSBI.greaterThan(JSBI.subtract(currentBlockNumber, parseBigintIsh(pylonInfo.strikeBlock)), TEN)) {
        bleed = JSBI.divide(blockDiff, TEN)
      }
      let newGammaEMA = JSBI.divide(
          JSBI.add(JSBI.multiply(parseBigintIsh(pylonInfo.gammaEMA), EMASamples), parseBigintIsh(pylonInfo.thisBlockEMA)),
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

  public static derivativeCheck(p2x: JSBI, p2y: JSBI, res0: JSBI, res1: JSBI, adjVAB: JSBI, decimals: Decimals) : boolean {
    let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), res1)
    p3x = JSBI.divide(JSBI.multiply(p3x, parseBigintIsh(decimals.float)), res0)
    let coefficients = Library.calculateParabolaCoefficients(p2x, p2y, p3x, adjVAB, decimals, true)

    if (JSBI.equal(coefficients.a, _42E45)) {
      return true
    }
    return !(!coefficients.isANegative || coefficients.isBNegative || JSBI.greaterThan(coefficients.b, JSBI.divide(JSBI.multiply(TWO, JSBI.multiply(coefficients.a, p3x)),parseBigintIsh(decimals.anchor))));
  }

  public static getFeeByGamma(gamma: JSBI, minFee: JSBI, maxFee: JSBI): JSBI {
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
      return JSBI.add(minFee, JSBI.divide(JSBI.multiply(JSBI.multiply(maxFee, x), x), JSBI.BigInt(25e36)))
    } else {
      return JSBI.add(
          JSBI.divide(JSBI.multiply(JSBI.multiply(JSBI.multiply(minFee, x), x), JSBI.BigInt(36)), DOUBLE_BASE),
          minFee
      )
    }
  }


}
