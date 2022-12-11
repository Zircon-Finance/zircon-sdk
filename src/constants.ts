import JSBI from 'jsbi'
import PairABI from '../src/abis/ZirconPair.json'
import PylonABI from '../src/abis/ZirconPylon.json'
import PoolTokenABI from '../src/abis/ZirconPoolToken.json'

export const PAIR_ABI = PairABI
export const PYLON_ABI = PylonABI
export const POOL_TOKEN_ABI = PoolTokenABI
// exports for external consumption
export type BigintIsh = JSBI | bigint | string

export enum ChainId {
  MAINNET = 1,
  STANDALONE = 1281,
  MOONRIVER = 1285,
  MOONROCK = 1286,
  MOONBASE = 1287,
  MOONSHADOW = 1288
}

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT
}

export enum Rounding {
  ROUND_DOWN,
  ROUND_HALF_UP,
  ROUND_UP
}

export const MOONBASE_ADDRESSES = {
  WETH: '0xD909178CC99d318e4D46e7E66a972955859670E1',
  factory: '0x023767158272DA8130301112C23972E4daa08A7D',
  router: '0xFA7F690636f7AD16A516be25368a4AF76878bC27',
  multicall: '0xA37062C793fc1e5Aa46A844A7aE798365Dd7Ce83',
  pylonRouter: '0x72d181478F74b7C25E21cD84ce48C12187943223',
  pylonFactory: '0x0035D77ECb5EA7D69621e0bDa68681a18fe1172d', //// THIS IS MOONBASE, IGNORE
  energyFactory: '0xB6BA4eEE467F5674d33647Cd605E036D300c4365',
  farmFactory: '0x931dEA8C13472452c77065B6eB087E87A16a1BFe',
  ptFactory: '0xE06B012D07884a90C70960E1297e11F67023DFa3',
  migrator: '0xAD42C89dfE3DdefFe4f3268370078d3d9CA1119d',
  feeToSetter: '0x7A282B0BE9676BCc6377eD81A6f1196f0e7647a6',
  firstMigration: {
    migration: '0x1153550210Bbef5b74890b242F37Ae24E1F41440',
    bytecode: '0x9fc442a4d7a12215c697eb81564442a0cd83ff2b9db622486b898fe36004e492'
  }
}

export const MOONRIVER_ADDRESSES = {
  WETH: '0x98878B06940aE243284CA214f92Bb71a2b032B8A',
  factory: '0xb48f90735E782af1B3653059C199A4836Ce277B8',
  router: '0x30b7F2983366828d627F9A269C8FeA2fc9bF41e6',
  multicall: '0x5B1b125e496c4a61331E9D9cCE32f6FC5Cf86B2e',
  pylonRouter: '0xdb26A203b0Fc7766A1b1ce943f187C89eB027e8C',
  pylonFactory: '0x7837666F362894b0587bBEe99a8Fb22A6A6Eb382',
  energyFactory: '0x992182a71c9D8dD6fAF5fF54D7AcF753c3462Dcc',
  farmFactory: '0x97b2aE105DAFb7DC8a73c93e5f56d3f095D0DCF3',
  ptFactory: '0x3524196a3Bd704C000E35c89E88600Fff529df04',
  migrator: '0xfE50e1d704BDdD46e0FDeF226a4bCbD31b6C39dA',
  feeToSetter: '0x7DBD08a0b27B1C288DDD3b47a116690dC6eAAC62',
  firstMigration: {
    migrationAddress: '0x1153550210Bbef5b74890b242F37Ae24E1F41440',
    bytecode: '0x9fc442a4d7a12215c697eb81564442a0cd83ff2b9db622486b898fe36004e492'
  },
  secondMigration: {
    migrationAddress: '0x3dA19d8f9f1208f844edE1b6Ac6caF2c14a318bD',
    bytecode: '0x44ca8087c95ad2e8ea0739f78fa06a76fc246d61762366f5b76eded713fadbb2'
  }
}

export const MIGRATION_PYLONS: { [key: string]: { migrationAddress: string; bytecode: string } } = {
  // FIRST MIGRATION
  '0x61AE2D03E81726cCDB4C1077330a1c40B7D6622c': MOONRIVER_ADDRESSES.firstMigration,
  '0xF44082B689d28B686E3c640995d2Eca80B27aa4c': MOONRIVER_ADDRESSES.firstMigration,
  '0x80420B0e0FA209C803B19Dc650E45Ae29b4A55a9': MOONRIVER_ADDRESSES.firstMigration,
  '0xDd7B7849002cF2Fd1eb5B659BDA209132ddD19d0': MOONRIVER_ADDRESSES.firstMigration,
  '0xD9462b7f6Dac3851E21a693fB52ee6D0451806d8': MOONRIVER_ADDRESSES.firstMigration,
  '0x047A55Eff2f99eCF1060A5e3BA8Ef31f1d8555F7': MOONRIVER_ADDRESSES.firstMigration,
  '0x3f3b999e56d0C81cfb7c320aeC5bacad97f70A40': MOONRIVER_ADDRESSES.firstMigration,
  '0x643C57F8E3c4aA5A163Bf64213fE810E1088a57A': MOONRIVER_ADDRESSES.firstMigration,
  '0xbf6669f7C787D7D7262883431E84C21108348f5d': MOONRIVER_ADDRESSES.firstMigration,
  '0x12035Aaa3c74287062F24d692A116715244C68E6': MOONRIVER_ADDRESSES.firstMigration,
  '0x26eB89F663003D24F7CA3269B349F521f8beB2A9': MOONRIVER_ADDRESSES.firstMigration,
  '0x328b75F789486d6F8894d364D712B66A87cB7FcF': MOONRIVER_ADDRESSES.firstMigration,
  '0x15a3ba581CC1e3D8C46CAfbB4E786839792E4181': MOONRIVER_ADDRESSES.firstMigration,
  '0x49522a2615136193A739530fd9CB698DC2EBf5ec': MOONRIVER_ADDRESSES.firstMigration,
  '0xE77f4B3B1D6cF0c41b5BFA0a24d053f7C1393De1': MOONRIVER_ADDRESSES.firstMigration,
  '0x67be3b5601D377599a41FADD927EEb6b81b2160c': MOONRIVER_ADDRESSES.firstMigration,
  '0xb0EdA3Ce140590048E8Eb2f7512d3FA50FebC708': MOONRIVER_ADDRESSES.firstMigration,
  '0x05B3b819E969e28186b25CcDCE44C935b93ec9A3': MOONRIVER_ADDRESSES.firstMigration,
  '0x157BcE1C49E041bA8b7ba3eb04b5CC3fd4B39A21': MOONRIVER_ADDRESSES.firstMigration,
  // SECOND MIGRATION
  '0xADb9b5Df2599622e8B4aD6dA1CBDCb830cA89987': MOONRIVER_ADDRESSES.secondMigration,
  '0xFBEEeF3D6518D10c3AFa0ecc84eFaDB323Db467d': MOONRIVER_ADDRESSES.secondMigration
}

// MOONBASE
// deploying "Migrator" (tx: 0xcd5c69ba9da0ef02bf6967c98daf601c8406511fdd3d50de53cc0a4bef687b1c)...: deployed at 0x49675A06F3D243583ecDD55C7FAf26F9b4aD9200 with 1319591 gas
// deploying "FeeToSetter" (tx: 0xb79e0291208313be9918fa5c87860e0805dfd04c728c9d46beed27cedc18bd96)...: deployed at 0xbCea98Df85045F2Fcf5310fE4237ca95C9C24622 with 798377 gas
// deploying "ZirconPeripheralLibrary" (tx: 0xd01ee89156e29acfb8d144aaddd7f9e46b66f156e588cdfa34f2844bd3b97948)...: deployed at 0x1234f5318Ae71813fb03013A4ab3c302b750837c with 277288 gas

// MOONRIVER
// deploying "Migrator" (tx: 0xa109149e40e5438b2ac2bbe5d50e07c5ee4e93180dd7a82bed7f1d45652489cc)...: deployed at 0x3413B287b0B75D9111Ebcc220d624E84AA5c00e8 with 1319591 gas
// deploying "FeeToSetter" (tx: 0xf1ee3431638da0ac8f034cfab30c4787889383630c7fd6115c38c92590e89fe1)...: deployed at 0xa1428f71616254E9c2E80946bb0C0F1948E808Db with 798377 gas
// deploying "ZirconPeripheralLibrary" (tx: 0x3f1d59fad3f0874ca0b0051b103bd6ab1fc6529307737253b3a6fceca7a3ec79)...: deployed at 0xCc4993a8D8C9e6Ed0757e0455c5CeaDCD48b6520 with 277288 gas

export const FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0x2E2Ed0Cfd3AD2f1d34481277b3204d807Ca2F8c2',
  [ChainId.MOONRIVER]: MOONRIVER_ADDRESSES.factory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.factory,
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.factory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.factory
}

export const PYLON_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD',
  [ChainId.MOONRIVER]: MOONRIVER_ADDRESSES.pylonFactory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.pylonFactory,
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.pylonFactory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.pylonFactory
}
export const PT_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43',
  [ChainId.MOONRIVER]: MOONRIVER_ADDRESSES.ptFactory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.ptFactory,
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.ptFactory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.ptFactory
}
export const EN_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43',
  [ChainId.MOONRIVER]: MOONRIVER_ADDRESSES.energyFactory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.energyFactory,
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.energyFactory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.energyFactory
}

export const FARM_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43',
  [ChainId.MOONRIVER]: MOONRIVER_ADDRESSES.farmFactory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.farmFactory,
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.farmFactory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.farmFactory
}

export const MULTICALL_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43',
  [ChainId.MOONRIVER]: MOONRIVER_ADDRESSES.multicall,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.multicall,
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.multicall,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.multicall
}

export const PYLON_CODE_HASH: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xafaf6286555f731e9581935e0bb62d3fec24c96b73c638aa7b5a8b9fbc595e39',
  [ChainId.MOONRIVER]: '0xbc14739d9e3a534adaa23ec7ee2d2bd78805be36b56798919f77e6536b981ae6',
  [ChainId.MOONBASE]: '0xafaf6286555f731e9581935e0bb62d3fec24c96b73c638aa7b5a8b9fbc595e39',
  [ChainId.MOONROCK]: '0xafaf6286555f731e9581935e0bb62d3fec24c96b73c638aa7b5a8b9fbc595e39',
  [ChainId.MOONSHADOW]: '0xafaf6286555f731e9581935e0bb62d3fec24c96b73c638aa7b5a8b9fbc595e39'
}
export const EN_CODE_HASH: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0x7dbf34a78ca182281ead469dc72e9462a253283ebb019f4e1ce0279f0045520a',
  [ChainId.MOONRIVER]: '0xf16adccb1404455f6418b5107daf7123cc0f6c94217218198385bebe277933b9',
  [ChainId.MOONBASE]: '0x7dbf34a78ca182281ead469dc72e9462a253283ebb019f4e1ce0279f0045520a',
  [ChainId.MOONROCK]: '0x7dbf34a78ca182281ead469dc72e9462a253283ebb019f4e1ce0279f0045520a',
  [ChainId.MOONSHADOW]: '0x7dbf34a78ca182281ead469dc72e9462a253283ebb019f4e1ce0279f0045520a'
}

export const INIT_CODE_HASH = '0x0ec3a964af2d4288dcee11cf85135843bcfc1e8e4f8a107d634a0818cc792ee7'
// export const MIGRATED_PYLON_CODE_HASH = "0x44ca8087c95ad2e8ea0739f78fa06a76fc246d61762366f5b76eded713fadbb2";
export const PT_CODE_HASH = '0x584a9deddda96e2bea8b2f7be35b08d7ddfd6fa4da2a026d973bc5ba1bbee91a'

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)
export const THREE = JSBI.BigInt(3)
export const FOUR = JSBI.BigInt(4)
export const FIVE = JSBI.BigInt(5)
export const TEN = JSBI.BigInt(10)
export const EIGHTEEN = JSBI.BigInt(18)
export const THIRTYSIX = JSBI.BigInt(36)
export const BASE = JSBI.exponentiate(TEN, EIGHTEEN)
export const DOUBLE_BASE = JSBI.exponentiate(TEN, THIRTYSIX)
export const _100 = JSBI.BigInt(100)
export const _112 = JSBI.BigInt(112)
export const _200 = JSBI.BigInt(200)
export const _997 = JSBI.BigInt(997)
export const _1000 = JSBI.BigInt(1000)
export const _10000 = JSBI.BigInt(10000)

export enum SolidityType {
  uint8 = 'uint8',
  uint256 = 'uint256'
}

export const SOLIDITY_TYPE_MAXIMA = {
  [SolidityType.uint8]: JSBI.BigInt('0xff'),
  [SolidityType.uint256]: JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
}
