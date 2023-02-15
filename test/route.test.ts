import { Token, WDEV, ChainId, Pair, TokenAmount, Route, NATIVE_TOKEN} from '../src'

describe('Route', () => {
  const token0 = new Token(ChainId.STANDALONE, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(ChainId.STANDALONE, '0x0000000000000000000000000000000000000002', 18, 't1')
  const weth = WDEV[ChainId.STANDALONE]
  const pair_0_1 = new Pair(new TokenAmount(token0, '100'), new TokenAmount(token1, '200'), '0', '30')
  const pair_0_weth = new Pair(new TokenAmount(token0, '100'), new TokenAmount(weth, '100'), '0', '30')
  const pair_1_weth = new Pair(new TokenAmount(token1, '175'), new TokenAmount(weth, '100'), '0', '30')

  it('constructs a path from the tokens', () => {
    const route = new Route([pair_0_1], token0)
    expect(route.pairs).toEqual([pair_0_1])
    expect(route.path).toEqual([token0, token1])
    expect(route.input).toEqual(token0)
    expect(route.output).toEqual(token1)
    expect(route.chainId).toEqual(ChainId.STANDALONE)
  })

  it('can have a token as both input and output', () => {
    const route = new Route([pair_0_weth, pair_0_1, pair_1_weth], weth)
    expect(route.pairs).toEqual([pair_0_weth, pair_0_1, pair_1_weth])
    expect(route.input).toEqual(weth)
    expect(route.output).toEqual(weth)
  })

  it('supports NATIVE_TOKEN[token0.chainId] input', () => {
    const route = new Route([pair_0_weth], NATIVE_TOKEN[token0.chainId])
    expect(route.pairs).toEqual([pair_0_weth])
    expect(route.input).toEqual(NATIVE_TOKEN[token0.chainId])
    expect(route.output).toEqual(token0)
  })

  it('supports NATIVE_TOKEN[token0.chainId] output', () => {
    const route = new Route([pair_0_weth], token0, NATIVE_TOKEN[token0.chainId])
    expect(route.pairs).toEqual([pair_0_weth])
    expect(route.input).toEqual(token0)
    expect(route.output).toEqual(NATIVE_TOKEN[token0.chainId])
  })
})
