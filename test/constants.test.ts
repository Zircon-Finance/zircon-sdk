import { INIT_CODE_HASH, PT_CODE_HASH, PYLON_CODE_HASH } from '../src/constants'
import { bytecode as pairBytecode } from '../src/abis/ZirconPair.json'
import { bytecode as pylonBytecode } from '../src/abis/ZirconPylon.json'
import { bytecode as ptBytecode } from '../src/abis/ZirconPoolToken.json'

import { keccak256 } from '@ethersproject/solidity'

// this _could_ go in constants, except that it would cost every consumer of the sdk the CPU to compute the hash
// and load the JSON.
const COMPUTED_INIT_CODE_HASH = keccak256(['bytes'], [`${pairBytecode}`])
const COMPUTED_PT_CODE_HASH = keccak256(['bytes'], [`${ptBytecode}`])
const COMPUTED_PYLON_CODE_HASH = keccak256(['bytes'], [`${pylonBytecode}`])

describe('constants', () => {
  describe('INIT_CODE_HASH', () => {
    it('matches computed bytecode hash', () => {
      expect(COMPUTED_INIT_CODE_HASH).toEqual(INIT_CODE_HASH)
    })
  })
  describe('PT_CODE_HASH', () => {
    it('matches computed bytecode hash', () => {
      expect(COMPUTED_PT_CODE_HASH).toEqual(PT_CODE_HASH)
    })
  })
  describe('PYLON_CODE_HASH', () => {
    it('matches computed bytecode hash', () => {
      expect(COMPUTED_PYLON_CODE_HASH).toEqual(PYLON_CODE_HASH)
    })
  })
})
