import { ChainId, Token, Pair, TokenAmount, WDEV, Price } from '../src'

describe('Pair', () => {
  const USDC = new Token(ChainId.MOONBASE, '0x4c945cD20DD13168BC87f30D55f12dC26512ca33', 18, 'USDC', 'USD Coin')
  const DAI = new Token(ChainId.MOONBASE, '0x08B40414525687731C23F430CEBb424b332b3d35', 18, 'DAI', 'DAI Stablecoin')

  // describe('constructor', () => {
  //   it('cannot be used for tokens on different chains', () => {
  //     expect(() => new Pair(new TokenAmount(USDC, '100'), new TokenAmount(WDEV[ChainId.MOONBASE], '100'))).toThrow(
  //       'CHAIN_IDS'
  //     )
  //   })
  // })

  // describe('#getAddress', () => {
  //   it('returns the correct address', () => {
  //
  //     console.log("this")
  //     let token0 = new Token(ChainId.MOONBASE, '0x08B40414525687731C23F430CEBb424b332b3d35', 18, 'pppppp', 'USD Coin')
  //     let token1 = new Token(ChainId.MOONBASE, '0x1FC56B105c4F0A1a8038c2b429932B122f6B631f', 18, 'pooooo', 'USD Coin')
  //     console.log(token0.address)
  //     console.log(token1.address)
  //     let t = Pylon.getLiquidityAddresses(USDC, DAI)
  //     console.log(t[0])
  //     console.log(t[1])
  //
  //
  //     expect(t[0]).toEqual('0x09E4Eb8C3412DC50D70d0E2c5151b31c8A349C26')
  //   })
  // })

  describe('#token0', () => {
    it('always is the token that sorts before', () => {
      expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).token0).toEqual(DAI)
      expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).token0).toEqual(DAI)
    })
  })
  describe('#token1', () => {
    it('always is the token that sorts after', () => {
      expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).token1).toEqual(USDC)
      expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).token1).toEqual(USDC)
    })
  })
  describe('#reserve0', () => {
    it('always comes from the token that sorts before', () => {
      expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserve0).toEqual(
        new TokenAmount(DAI, '101')
      )
      expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserve0).toEqual(
        new TokenAmount(DAI, '101')
      )
    })
  })
  describe('#reserve1', () => {
    it('always comes from the token that sorts after', () => {
      expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserve1).toEqual(
        new TokenAmount(USDC, '100')
      )
      expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserve1).toEqual(
        new TokenAmount(USDC, '100')
      )
    })
  })

  describe('#token0Price', () => {
    it('returns price of token0 in terms of token1', () => {
      expect(new Pair(new TokenAmount(USDC, '101'), new TokenAmount(DAI, '100')).token0Price).toEqual(
        new Price(DAI, USDC, '100', '101')
      )
      expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '101')).token0Price).toEqual(
        new Price(DAI, USDC, '100', '101')
      )
    })
  })

  describe('#token1Price', () => {
    it('returns price of token1 in terms of token0', () => {
      expect(new Pair(new TokenAmount(USDC, '101'), new TokenAmount(DAI, '100')).token1Price).toEqual(
        new Price(USDC, DAI, '101', '100')
      )
      expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '101')).token1Price).toEqual(
        new Price(USDC, DAI, '101', '100')
      )
    })
  })

  describe('#priceOf', () => {
    const pair = new Pair(new TokenAmount(USDC, '101'), new TokenAmount(DAI, '100'))
    it('returns price of token in terms of other token', () => {
      expect(pair.priceOf(DAI)).toEqual(pair.token0Price)
      expect(pair.priceOf(USDC)).toEqual(pair.token1Price)
    })

    it('throws if invalid token', () => {
      expect(() => pair.priceOf(WDEV[ChainId.MOONBASE])).toThrow('TOKEN')
    })
  })

  describe('#reserveOf', () => {
    it('returns reserves of the given token', () => {
      expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserveOf(USDC)).toEqual(
        new TokenAmount(USDC, '100')
      )
      expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserveOf(USDC)).toEqual(
        new TokenAmount(USDC, '100')
      )
    })

    it('throws if not in the pair', () => {
      expect(() =>
        new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserveOf(WDEV[ChainId.MOONBASE])
      ).toThrow('TOKEN')
    })
  })

  describe('#chainId', () => {
    it('returns the token0 chainId', () => {
      expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).chainId).toEqual(ChainId.MOONBASE)
      expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).chainId).toEqual(ChainId.MOONBASE)
    })
  })
  describe('#involvesToken', () => {
    expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(USDC)).toEqual(true)
    expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(DAI)).toEqual(true)
    expect(
      new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(WDEV[ChainId.MOONBASE])
    ).toEqual(false)
  })
})
