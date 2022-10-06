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
  "WETH": "0xD909178CC99d318e4D46e7E66a972955859670E1",
  "factory": "0x6D934416741C25aA2C87Fe9D35757a41820a046d",
  "router": "0x53Ea41686bB32092e3fe712C375C3B2F1b2c5A01",
  "multicall": "0xA37062C793fc1e5Aa46A844A7aE798365Dd7Ce83",
  "pylonRouter": "0xC5Cc92B016e6fd1838a3bE4F0Fb26D1dDfc060Cf",
  "pylonFactory": "0x8D40Ac43Ef276493DF8b2E71C18442DC3CE2E121",
  "energyFactory": "0x3d08bCe361b45c33fddFD27f39bF9f5f24006EF1",
  "farmFactory": "0x931dEA8C13472452c77065B6eB087E87A16a1BFe",
  "ptFactory": "0x3EbB4d256C123D9bBccabcfB4cBd0c89A569F867",
  "migrator": "0xec89E7389Cfa95A801f8ddC18dA92C1165280971",
  "feeToSetter": "0xbCea98Df85045F2Fcf5310fE4237ca95C9C24622",
  "migratedPylonFactory": "0x8D40Ac43Ef276493DF8b2E71C18442DC3CE2E121"
};
export const MOONRIVER_ADDRESSES = {
  "WETH": "0x98878B06940aE243284CA214f92Bb71a2b032B8A",
  "factory": "0x6B6071Ccc534fcee7B699aAb87929fAF8806d5bd",
  "router": "0x53Ea41686bB32092e3fe712C375C3B2F1b2c5A01",
  "multicall": "0x5B1b125e496c4a61331E9D9cCE32f6FC5Cf86B2e",
  "pylonRouter": "0x385CC0c86DEf4dea78F6b3f0dBbfa3FB12FfecB5",
  "pylonFactory": "0x3dA19d8f9f1208f844edE1b6Ac6caF2c14a318bD",
  "energyFactory": "0x9b38fD03fAf64Dcc5F1da1101326a072092420A8",
  "farmFactory": "0x97b2aE105DAFb7DC8a73c93e5f56d3f095D0DCF3",
  "ptFactory": "0x2D4ddeB8b183413e9D88A98Fa3Dd844e34D41c54",
  "migrator": "0x6B722a4835055BE4DEcFb28646D5C2D9dFE43eFd",
  "feeToSetter": "0x4bA754989b77925F47e26C54aaa1b03Df23B32Ce",
  "migratedPylonFactory": "0x1153550210Bbef5b74890b242F37Ae24E1F41440"
};
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

export const MIGRATED_PYLON_FACTORY_ADDRESS: { [key: string]: string } = {
  [ChainId.STANDALONE]: '0xDC11f7E700A4c898AE5CAddB1082cFfa76512aDD',
  [ChainId.MOONRIVER]: MOONRIVER_ADDRESSES.migratedPylonFactory,
  [ChainId.MOONBASE]: MOONBASE_ADDRESSES.migratedPylonFactory,
  [ChainId.MOONROCK]: MOONBASE_ADDRESSES.migratedPylonFactory,
  [ChainId.MOONSHADOW]: MOONBASE_ADDRESSES.migratedPylonFactory
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

export const INIT_CODE_HASH = "0x0ec3a964af2d4288dcee11cf85135843bcfc1e8e4f8a107d634a0818cc792ee7";
export const PYLON_CODE_HASH = "0x44ca8087c95ad2e8ea0739f78fa06a76fc246d61762366f5b76eded713fadbb2";
// export const MIGRATED_PYLON_CODE_HASH = "0x44ca8087c95ad2e8ea0739f78fa06a76fc246d61762366f5b76eded713fadbb2";
export const MIGRATED_PYLON_CODE_HASH = "0x9fc442a4d7a12215c697eb81564442a0cd83ff2b9db622486b898fe36004e492";
export const PT_CODE_HASH = "0x584a9deddda96e2bea8b2f7be35b08d7ddfd6fa4da2a026d973bc5ba1bbee91a";
export const EN_CODE_HASH = "0x7dbf34a78ca182281ead469dc72e9462a253283ebb019f4e1ce0279f0045520a";

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
