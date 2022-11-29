import JSBI from 'jsbi'
import { BigintIsh } from '../constants'
import { parseBigintIsh } from '../utils'

export class PylonFactory {
  public deltaGammaThreshold: JSBI
  public deltaGammaFee: JSBI
  public minFee: JSBI
  public maxFee: JSBI
  public maxSync: JSBI
  public liquidityFee: JSBI
  public EMASamples: JSBI
  public muUpdatePeriod: JSBI
  public muChangeFactor: JSBI
  public dynamicRatio: JSBI
  public feePercentageRev: JSBI
  public feePercentageEnergy: JSBI
  public oracleUpdateSecs: JSBI

  public constructor(
    maximumPercentageSync: BigintIsh,
    deltaGammaThreshold: BigintIsh,
    deltaGammaMinFee: BigintIsh,
    EMASamples: BigintIsh,
    muUpdatePeriod: BigintIsh,
    muChangeFactor: BigintIsh,
    oracleUpdateSecs: BigintIsh,
    liquidityFee: BigintIsh,
    dynamicRatio: BigintIsh,
    feePercentageRev: BigintIsh,
    feePercentageEnergy: BigintIsh,
    minFee: BigintIsh,
    maxFee: BigintIsh
  ) {
    this.maxSync = parseBigintIsh(maximumPercentageSync)
    this.feePercentageRev = parseBigintIsh(feePercentageRev)
    this.feePercentageEnergy = parseBigintIsh(feePercentageEnergy)
    this.deltaGammaThreshold = parseBigintIsh(deltaGammaThreshold)
    this.deltaGammaFee = parseBigintIsh(deltaGammaMinFee)
    this.minFee = parseBigintIsh(minFee)
    this.maxFee = parseBigintIsh(maxFee)
    this.liquidityFee = parseBigintIsh(liquidityFee)
    this.EMASamples = parseBigintIsh(EMASamples)
    this.muUpdatePeriod = parseBigintIsh(muUpdatePeriod)
    this.muChangeFactor = parseBigintIsh(muChangeFactor)
    this.dynamicRatio = parseBigintIsh(dynamicRatio)
    this.oracleUpdateSecs = parseBigintIsh(oracleUpdateSecs)
  }
  public setMaxSync(maximumPercentageSync: BigintIsh)  {
    this.maxSync = parseBigintIsh(maximumPercentageSync)
  }
}
