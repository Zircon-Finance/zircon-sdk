import JSBI from 'jsbi'
import {_42E45, BASE, DOUBLE_BASE, ONE, TEN, TWO, ZERO} from '../constants'
import {parseBigintIsh, sqrt} from '../utils'
import {PylonInfo} from "interfaces/pylonInterface";

export abstract class Library {
  public static getFTVForX(x: JSBI, p2x: JSBI, p2y: JSBI, reserve0: JSBI, reserve1: JSBI, adjVAB: JSBI): JSBI {
    let ftv = ZERO

    let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), reserve1)
    p3x = JSBI.divide(JSBI.multiply(p3x, BASE), reserve0)

    if (JSBI.greaterThanOrEqual(x, p3x)) {
      ftv = JSBI.multiply(TWO, sqrt(JSBI.multiply(JSBI.divide(JSBI.multiply(reserve0, reserve1), BASE), x)))
    } else {
      let coefficients = this.calculateParabolaCoefficients(p2x, p2y, p3x, adjVAB, false)

      if (
        !coefficients.isANegative ||
        JSBI.greaterThan(coefficients.b, JSBI.divide(JSBI.multiply(TWO, JSBI.multiply(coefficients.a, p3x)), BASE))
      ) {
        ftv = coefficients.isANegative
          ? JSBI.subtract(
              JSBI.multiply(coefficients.b, x),
              JSBI.multiply(JSBI.divide(JSBI.multiply(coefficients.a, x), BASE), x)
            )
          : JSBI.add(
              JSBI.multiply(coefficients.b, x),
              JSBI.multiply(JSBI.divide(JSBI.multiply(coefficients.a, x), BASE), x)
            )
      } else {
        throw new Error('ZP: ExFlt2')
      }
    }

    return ftv
  }

  // Parabola coefficients calculations
  public static calculateP2(k: JSBI, vab: JSBI, vfb: JSBI): { p2x: JSBI; p2y: JSBI } {
    let p2y = JSBI.subtract(JSBI.divide(JSBI.multiply(k, TWO), vfb), vab)
    return {
      p2x: JSBI.divide(JSBI.multiply(p2y, BASE), vfb),
      p2y
    }
  }

  public static evaluateP2(
    x: JSBI,
    adjVAB: JSBI,
    adjVFB: JSBI,
    res0: JSBI,
    res1: JSBI,
    desiredFTV: JSBI
  ): { p2x: JSBI; p2y: JSBI } {
    let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), res0)
    p3x = JSBI.divide(JSBI.multiply(p3x, BASE), res1)

    if (JSBI.lessThan(x, p3x)) {
      return {
        p2x: x,
        p2y: desiredFTV
      }
    } else {
      return this.calculateP2(JSBI.multiply(res0, res1), adjVAB, adjVFB)
    }
  }

  public static calculateParabolaCoefficients(
    p2x: JSBI,
    p2y: JSBI,
    p3x: JSBI,
    p3y: JSBI,
    check: boolean
  ): { a: JSBI; b: JSBI; isANegative: boolean } {
    if (JSBI.lessThan(p3x, p2x)) {
      if (!check) {
        throw new Error('p3x < p2x')
      } else {
        return { a: _42E45, b: _42E45, isANegative: false }
      }
    }

    if (JSBI.equal(p2x, p3x)) {
      return { a: ZERO, b: JSBI.divide(JSBI.multiply(p3y, BASE), p3x), isANegative: false }
    }
    let a = ZERO
    let b = ZERO
    let isANegative = false

    let aPartial1 = JSBI.multiply(p3y, p2x)
    let aPartial2 = JSBI.multiply(p2y, p3x)
    let aDenominator = JSBI.divide(JSBI.multiply(JSBI.subtract(p3x, p2x), p3x), BASE)

    if (JSBI.greaterThanOrEqual(aPartial1, aPartial2)) {
      let aNumerator = JSBI.divide(JSBI.subtract(aPartial1, aPartial2), p2x)
      a = JSBI.divide(JSBI.multiply(aNumerator, BASE), aDenominator)
      if (
        JSBI.greaterThanOrEqual(JSBI.divide(JSBI.multiply(BASE, p2y), p2x), JSBI.divide(JSBI.multiply(a, p2x), BASE))
      ) {
        throw new Error('B negative')
      }
      b = JSBI.subtract(JSBI.divide(JSBI.multiply(BASE, p2y), p2x), JSBI.divide(JSBI.multiply(a, p2x), BASE))
      isANegative = false
    } else {
      let aNumerator = JSBI.divide(JSBI.subtract(aPartial2, aPartial1), p2x)
      a = JSBI.divide(JSBI.multiply(aNumerator, BASE), aDenominator)
      b = JSBI.add(JSBI.divide(JSBI.multiply(BASE, p2y), p2x), JSBI.divide(JSBI.multiply(a, p2x), BASE))
      isANegative = true
    }

    return { a, b, isANegative }
  }

  public static calculateGamma(
    resTR0: JSBI,
    resTR1: JSBI,
    adjVAB: JSBI,
    p2x: JSBI,
    p2y: JSBI
  ): { gamma: JSBI; isLineFormula: boolean } {
    let tpva = JSBI.multiply(resTR1, TWO)

    let gamma = ZERO
    let formulaSwitch = false
    let p3x = JSBI.divide(JSBI.exponentiate(adjVAB, TWO), resTR0)
    p3x = JSBI.divide(JSBI.multiply(p3x, BASE), resTR1)
    let x = JSBI.divide(JSBI.multiply(resTR1, BASE), resTR0)
    if (JSBI.greaterThanOrEqual(x, p3x)) {
      gamma = JSBI.subtract(BASE, JSBI.divide(JSBI.multiply(adjVAB, BASE), tpva))
      formulaSwitch = false
    } else {
      let coefficients = Library.calculateParabolaCoefficients(p2x, p2y, p3x, adjVAB, false)
      if (
        !coefficients.isANegative ||
        JSBI.greaterThan(coefficients.b, JSBI.divide(JSBI.multiply(TWO, JSBI.multiply(coefficients.a, p3x)), BASE))
      ) {
        let ftv = coefficients.isANegative
          ? JSBI.subtract(
              JSBI.multiply(coefficients.b, x),
              JSBI.multiply(JSBI.divide(JSBI.multiply(coefficients.a, x), BASE), x)
            )
          : JSBI.add(
              JSBI.multiply(coefficients.b, x),
              JSBI.multiply(JSBI.divide(JSBI.multiply(coefficients.a, x), BASE), x)
            )

        gamma = JSBI.divide(ftv, tpva)
        formulaSwitch = true
      } else {
        throw new Error('Float Error')
      }
    }
    return { gamma, isLineFormula: formulaSwitch }
  }

  public static translateToPylon(toTranslate: JSBI, ptb: JSBI, ptt: JSBI) {
    return JSBI.divide(JSBI.multiply(toTranslate, ptb), ptt)
  }

  public static calculateEMA(pylonInfo: PylonInfo, currentBlockNumber: JSBI, EMASamples: JSBI, gamma: JSBI): JSBI {
    // Calculating Total Pool Value Anchor Prime
    let oldGamma = parseBigintIsh(pylonInfo.gammaMulDecimals)
    let blockDiff = JSBI.subtract(currentBlockNumber, parseBigintIsh(pylonInfo.EMABlockNumber))
    console.log('zz:: ', blockDiff.toString(), gamma.toString(), oldGamma.toString())
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
      return JSBI.divide(JSBI.multiply(JSBI.multiply(maxFee, x), x), JSBI.BigInt(25e36))
    } else {
      return JSBI.add(
          JSBI.divide(JSBI.multiply(JSBI.multiply(JSBI.multiply(minFee, x), x), JSBI.BigInt(36)), DOUBLE_BASE),
          minFee
      )
    }
  }
}
