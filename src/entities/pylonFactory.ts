import JSBI from "jsbi";
import {BigintIsh} from "../constants";
import { parseBigintIsh } from '../utils'


export class PylonFactory{

    public deltaGammaThreshold: JSBI;
    public deltaGammaFee: JSBI;
    public minFee: JSBI;
    public maxFee: JSBI;
    public maxSync: JSBI;
    public liquidityFee: JSBI;
    public EMASamples: JSBI;
    public muUpdatePeriod: JSBI;
    public muChangeFactor: JSBI;

    public constructor(deltaGammaTreshold: BigintIsh, deltaGammaFee: BigintIsh, minFee: BigintIsh, maxFee: BigintIsh, maxSync: BigintIsh,
                       liquidityFee: BigintIsh, EMASamples: BigintIsh, muUpdatePeriod: BigintIsh, muChangeFactor: BigintIsh){
        this.deltaGammaThreshold = parseBigintIsh(deltaGammaTreshold);
        this.deltaGammaFee = parseBigintIsh(deltaGammaFee);
        this.minFee = parseBigintIsh(minFee);
        this.maxFee = parseBigintIsh(maxFee);
        this.maxSync = parseBigintIsh(maxSync);
        this.liquidityFee = parseBigintIsh(liquidityFee);
        this.EMASamples = parseBigintIsh(EMASamples);
        this.muUpdatePeriod = parseBigintIsh(muUpdatePeriod);
        this.muChangeFactor = parseBigintIsh(muChangeFactor);
    }
}
