import {ChainId, Token, TokenAmount, Pair, InsufficientInputAmountError, Pylon} from '../src'
import { sortedInsert } from '../src/utils'
import JSBI from "jsbi";

describe('miscellaneous', () => {
  it('getLiquidityMinted:0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '0'), new TokenAmount(tokenB, '0'))

    expect(() => {
      pair.getLiquidityMinted(
        new TokenAmount(pair.liquidityToken, '0'),
        new TokenAmount(tokenA, '1000'),
        new TokenAmount(tokenB, '1000')
      )
    }).toThrow(InsufficientInputAmountError)

    expect(() => {
      pair.getLiquidityMinted(
        new TokenAmount(pair.liquidityToken, '0'),
        new TokenAmount(tokenA, '1000000'),
        new TokenAmount(tokenB, '1')
      )
    }).toThrow(InsufficientInputAmountError)

    const liquidity = pair.getLiquidityMinted(
      new TokenAmount(pair.liquidityToken, '0'),
      new TokenAmount(tokenA, '1001'),
      new TokenAmount(tokenB, '1001')
    )

    expect(liquidity.raw.toString()).toEqual('1')
  })



  it('getLiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '10000'), new TokenAmount(tokenB, '10000'))

    expect(
      pair
        .getLiquidityMinted(
          new TokenAmount(pair.liquidityToken, '10000'),
          new TokenAmount(tokenA, '2000'),
          new TokenAmount(tokenB, '2000')
        )
        .raw.toString()
    ).toEqual('2000')
  })

  it('initPylon:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '0'), new TokenAmount(tokenB, '0'))
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '0'), new TokenAmount(tokenB, '0'))
    let init = pylon.initializeValues(
        new TokenAmount(pair.liquidityToken, "3001666203960726876344"),
        new TokenAmount(tokenA, "481818181818181818181"),
        new TokenAmount(tokenB, "154545454545454545454")
    )
    expect(init[0].toString(10)).toEqual('481818181818181817181')
    expect(init[1].toString(10)).toEqual('154545454545454544454')
  })

  it('getAnchorSyncLiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '12866889738045730064'), new TokenAmount(tokenB, '117003201248779581880'))
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '47201171045179026'), new TokenAmount(tokenB, '425209926505030123'))
    let fSync = pylon.getAnchorSyncLiquidityMinted(
            new TokenAmount(pair.liquidityToken, '37258980980455003931'),
            new TokenAmount(pylon.anchorLiquidityToken, '9090909090909090909'),
            new TokenAmount(tokenB, '5000000000000000'),
            //new TokenAmount(tokenB, '2000000000000000000000'),
            JSBI.BigInt("9394220164340522812"),
            JSBI.BigInt("947728772470068004"),
            JSBI.BigInt("475687425453480295"),
            JSBI.BigInt("1269795190837184468477014317641265640320"),
            new TokenAmount(tokenA, '2740478858540395822'),
            new TokenAmount(tokenA, '34363255460224189141'),
    )
    expect(fSync.raw.toString(10)).toEqual("4820877360075378")
  })

  it('getFloatSyncLiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '12866889738045730064'), new TokenAmount(tokenB, '117003201248779581880'))
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '47201171045179026'), new TokenAmount(tokenB, '425209926505030123'))
    let fSync = pylon.getFloatSyncLiquidityMinted(
            new TokenAmount(pair.liquidityToken, '37258980980455003931'),
            new TokenAmount(pylon.floatLiquidityToken, '913912502191907675'),
            new TokenAmount(tokenA, '5000000000000000'),
            //new TokenAmount(tokenB, '2000000000000000000000'),
            JSBI.BigInt("9394220164340522812"),
            JSBI.BigInt("947728772470068004"),
            JSBI.BigInt("475687425453480295"),
            JSBI.BigInt("1269795190837184468477014317641265640320"),
            new TokenAmount(tokenA, '2740478858540395822'),
            new TokenAmount(tokenA, '34363255460224189141'),
    )
    expect(fSync.raw.toString(10)).toEqual("4800431590087814")
    //1055810837745529

  })
  it('getFloatAsyncLiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '12866889738045730064'), new TokenAmount(tokenB, '117003201248779581880'))
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '47201171045179026'), new TokenAmount(tokenB, '425209926505030123'))
    let fSync = pylon.getFloatAsyncLiquidityMinted(
            new TokenAmount(pair.liquidityToken, '37258980980455003931'),
            new TokenAmount(pylon.floatLiquidityToken, '913912502191907675'),
            new TokenAmount(tokenA, '5000000000000000'),
            new TokenAmount(tokenB, '5000000000000000'),
            JSBI.BigInt("9394220164340522812"),
            JSBI.BigInt("947728772470068004"),
            JSBI.BigInt("475687425453480295"),
            JSBI.BigInt("1269795190837184468477014317641265640320"),
            new TokenAmount(tokenA, '2740478858540395822'),
            new TokenAmount(tokenA, '34363255460224189141'),
    )
    expect(fSync.raw.toString(10)).toEqual("1055810837745529")
  })

  it('getAnchorSyncLiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '12866889738045730064'), new TokenAmount(tokenB, '117003201248779581880'))
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '47201171045179026'), new TokenAmount(tokenB, '425209926505030123'))
    let fSync = pylon.getAnchorAsyncLiquidityMinted(
        new TokenAmount(pair.liquidityToken, '37258980980455003931'),
        new TokenAmount(pylon.anchorLiquidityToken, '9090909090909090909'),
        new TokenAmount(tokenA, '5000000000000000'),
        new TokenAmount(tokenB, '5000000000000000'),
        JSBI.BigInt("9394220164340522812"),
        JSBI.BigInt("947728772470068004"),
        JSBI.BigInt("475687425453480295"),
        JSBI.BigInt("1269795190837184468477014317641265640320"),
        new TokenAmount(tokenA, '2740478858540395822'),
        new TokenAmount(tokenA, '34363255460224189141'),
    )
    expect(fSync.raw.toString(10)).toEqual("9641754720150756")
  })

  it('getAnchorAsync100LiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '12866889738045730064'), new TokenAmount(tokenB, '117003201248779581880'))
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '47201171045179026'), new TokenAmount(tokenB, '425209926505030123'))
    let fSync = pylon.getAnchorAsync100LiquidityMinted(
        new TokenAmount(pair.liquidityToken, '37258980980455003931'),
        new TokenAmount(pylon.anchorLiquidityToken, '9090909090909090909'),
        new TokenAmount(tokenB, '5000000000000000'),
        JSBI.BigInt("9394220164340522812"),
        JSBI.BigInt("947728772470068004"),
        JSBI.BigInt("475687425453480295"),
        JSBI.BigInt("1269795190837184468477014317641265640320"),
        new TokenAmount(tokenA, '2740478858540395822'),
        new TokenAmount(tokenA, '34363255460224189141'),
    )
    expect(fSync.raw.toString(10)).toEqual("4806312339911913")
  })

  it('getFloatAync100LiquidityMinted:!0', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '12866889738045730064'), new TokenAmount(tokenB, '117003201248779581880'))
    const pylon = new Pylon(pair, new TokenAmount(tokenA, '47201171045179026'), new TokenAmount(tokenB, '425209926505030123'))
    let fSync = pylon.getFloatAsync100LiquidityMinted(
        new TokenAmount(pair.liquidityToken, '37258980980455003931'),
        new TokenAmount(pylon.floatLiquidityToken, '913912502191907675'),
        new TokenAmount(tokenA, '5000000000000000'),
        JSBI.BigInt("9394220164340522812"),
        JSBI.BigInt("947728772470068004"),
        JSBI.BigInt("475687425453480295"),
        JSBI.BigInt("1269795190837184468477014317641265640320"),
        new TokenAmount(tokenA, '2740478858540395822'),
        new TokenAmount(tokenA, '34363255460224189141'),
    )
    expect(fSync.raw.toString(10)).toEqual("4785103352571548")
  })
  it('getLiquidityValue:!feeOn', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '1000'), new TokenAmount(tokenB, '1000'))

    {
      const liquidityValue = pair.getLiquidityValue(
        tokenA,
        new TokenAmount(pair.liquidityToken, '1000'),
        new TokenAmount(pair.liquidityToken, '1000'),
        false
      )
      expect(liquidityValue.token.equals(tokenA)).toBe(true)
      expect(liquidityValue.raw.toString()).toBe('1000')
    }

    // 500
    {
      const liquidityValue = pair.getLiquidityValue(
        tokenA,
        new TokenAmount(pair.liquidityToken, '1000'),
        new TokenAmount(pair.liquidityToken, '500'),
        false
      )
      expect(liquidityValue.token.equals(tokenA)).toBe(true)
      expect(liquidityValue.raw.toString()).toBe('500')
    }

    // tokenB
    {
      const liquidityValue = pair.getLiquidityValue(
        tokenB,
        new TokenAmount(pair.liquidityToken, '1000'),
        new TokenAmount(pair.liquidityToken, '1000'),
        false
      )
      expect(liquidityValue.token.equals(tokenB)).toBe(true)
      expect(liquidityValue.raw.toString()).toBe('1000')
    }
  })

  it('getLiquidityValue:feeOn', async () => {
    const tokenA = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000001', 18)
    const tokenB = new Token(ChainId.MOONBASE, '0x0000000000000000000000000000000000000002', 18)
    const pair = new Pair(new TokenAmount(tokenA, '1000'), new TokenAmount(tokenB, '1000'))

    const liquidityValue = pair.getLiquidityValue(
      tokenA,
      new TokenAmount(pair.liquidityToken, '500'),
      new TokenAmount(pair.liquidityToken, '500'),
      true,
      '250000' // 500 ** 2
    )
    expect(liquidityValue.token.equals(tokenA)).toBe(true)
    expect(liquidityValue.raw.toString()).toBe('917') // ceiling(1000 - (500 * (1 / 6)))
  })

  describe('#sortedInsert', () => {
    const comp = (a: number, b: number) => a - b

    it('throws if maxSize is 0', () => {
      expect(() => sortedInsert([], 1, 0, comp)).toThrow('MAX_SIZE_ZERO')
    })

    it('throws if items.length > maxSize', () => {
      expect(() => sortedInsert([1, 2], 1, 1, comp)).toThrow('ITEMS_SIZE')
    })

    it('adds if empty', () => {
      const arr: number[] = []
      expect(sortedInsert(arr, 3, 2, comp)).toEqual(null)
      expect(arr).toEqual([3])
    })

    it('adds if not full', () => {
      const arr: number[] = [1, 5]
      expect(sortedInsert(arr, 3, 3, comp)).toEqual(null)
      expect(arr).toEqual([1, 3, 5])
    })

    it('adds if will not be full after', () => {
      const arr: number[] = [1]
      expect(sortedInsert(arr, 0, 3, comp)).toEqual(null)
      expect(arr).toEqual([0, 1])
    })

    it('returns add if sorts after last', () => {
      const arr = [1, 2, 3]
      expect(sortedInsert(arr, 4, 3, comp)).toEqual(4)
      expect(arr).toEqual([1, 2, 3])
    })

    it('removes from end if full', () => {
      const arr = [1, 3, 4]
      expect(sortedInsert(arr, 2, 3, comp)).toEqual(4)
      expect(arr).toEqual([1, 2, 3])
    })

    it('uses comparator', () => {
      const arr = [4, 2, 1]
      expect(sortedInsert(arr, 3, 3, (a, b) => comp(a, b) * -1)).toEqual(1)
      expect(arr).toEqual([4, 3, 2])
    })

    describe('maxSize of 1', () => {
      it('empty add', () => {
        const arr: number[] = []
        expect(sortedInsert(arr, 3, 1, comp)).toEqual(null)
        expect(arr).toEqual([3])
      })
      it('full add greater', () => {
        const arr: number[] = [2]
        expect(sortedInsert(arr, 3, 1, comp)).toEqual(3)
        expect(arr).toEqual([2])
      })
      it('full add lesser', () => {
        const arr: number[] = [4]
        expect(sortedInsert(arr, 3, 1, comp)).toEqual(4)
        expect(arr).toEqual([3])
      })
    })
  })
})
