export interface TestInput {
    resPair0: string
    resPair1: string
    resPylon0: string
    resPylon1: string
    totalSupply: string
    ptb: string
    ptTotalSupply: string
    gamma: string
    mu: string
    vab: string
    gEMA: string
    akv: string
    fs: boolean
    isAnchor: boolean
    isBlocked: boolean
    lrkt: string
    thisBlockEMA: string
    EMABlockNumber: string
    strikeBlock: string
    lastFloatAccumulator: string
    blockNumber: string
    timestamp: string
    lastK: string
    price0CumulativeLast: string
    price1CumulativeLast: string
    amountOut: string
    amountIn: string
    amountIn2?: string // For Async use case
    lastOracleTimestamp: string
    lastBlockTimestamp: string
    skip: boolean
    maxSync?: string
    isSync: boolean
}

export const MINT_CASES: TestInput[] = [
    {
        resPair0: '9750000000000000000',
        resPair1: '19500000000000000000',
        resPylon0: '250000000000000000',
        resPylon1: '500000000000000000',
        totalSupply: '13788582233137676725',
        ptb: '6717514421272201481',
        ptTotalSupply: '5000000000000000000',
        gamma: '500000000000000000',
        mu: '500000000000000000',
        vab: '10000000000000000000',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: false,
        isBlocked: false,
        lrkt: '6717514421272201480',
        thisBlockEMA: '0',
        EMABlockNumber: '0',
        strikeBlock: '0',
        lastFloatAccumulator: '0',
        blockNumber: '20',
        timestamp: '1668873849',
        lastK: '190125000000000000000000000000000000000',
        price0CumulativeLast: '51922968585348276285304963292200960',
        price1CumulativeLast: '12980742146337069071326240823050240',
        amountOut: '99041938923289145',
        amountIn: '100000000000000000',
        lastOracleTimestamp: '1668862595',
        lastBlockTimestamp: '1668873799',
        skip: true,
        isSync: true
    },{
        resPair0: '19500000000000000000',
        resPair1: '9750000000000000000',
        resPylon0: '500000000000000000',
        resPylon1: '250000000000000000',
        totalSupply: '13788582233137676725',
        ptb: '6717514421272201481',
        ptTotalSupply: '5000000000000000000',
        gamma: '500000000000000000',
        mu: '500000000000000000',
        vab: '5000000000000000000',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: true,
        isBlocked: false,
        lrkt: '6717514421272201480',
        thisBlockEMA: '0',
        EMABlockNumber: '0',
        strikeBlock: '0',
        lastFloatAccumulator: '0',
        blockNumber: '90',
        timestamp: '1669196212',
        lastK: '190125000000000000000000000000000000000',
        price0CumulativeLast: '7788445287802241442795744493830144',
        price1CumulativeLast: '31153781151208965771182977975320576',
        amountOut: '99990000000000000',
        amountIn: '100000000000000000',
        lastOracleTimestamp: '1669196208',
        lastBlockTimestamp: '1669196211',
        skip: true,
        isSync: true
    },{
        resPair0: '580382380101448981943',
        resPair1: '16051050000000000000000',
        resPylon0: '850000000000000000',
        resPylon1: '2650000000000000000',
        totalSupply: '3030182032898353781669',
        ptb: '28515828937626905325',
        ptTotalSupply: '17000000000000000000',
        gamma: '500000000000000000',
        mu: '500000000000000000',
        vab: '53000000000000000000',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: false,
        isBlocked: false,
        lrkt: '28515828937626905324',
        thisBlockEMA: '0',
        EMABlockNumber: '0',
        strikeBlock: '0',
        lastFloatAccumulator: '0',
        blockNumber: '118',
        timestamp: '1669208036',
        lastK: '9182003152500000000000000000000000000000000',
        price0CumulativeLast: '80938745147748783621210678073136790',
        price1CumulativeLast: '8327268546706799026888531848749210',
        amountOut: '290440197734697325',
        amountIn: '170000000000000000',
        lastOracleTimestamp: '1669207934',
        lastBlockTimestamp: '1669207939',
        skip: true,
        isSync: true
    },{
        resPair0: '19525000000000000001',
        resPair1: '9762500000000000000',
        resPylon0: '475000000000000009',
        resPylon1: '337490000000000000',
        totalSupply: '13806259902667340413',
        ptb: '6735192090801865169',
        ptTotalSupply: '5099990000000000000',
        gamma: '499999999999999999',
        mu: '499999999999999999',
        vab: '5099990000000000000',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: true,
        isBlocked: false,
        lrkt: '6735192090801865168',
        thisBlockEMA: '0',
        EMABlockNumber: '145',
        strikeBlock: '0',
        lastFloatAccumulator: '142788163609707759770960573309366740',
        blockNumber: '147',
        timestamp: '1669314407',
        lastK: '190612812500000000009762500000000000000',
        price0CumulativeLast: '12980742146337069071326240823050240',
        price1CumulativeLast: '51922968585348276285304963292200960',
        amountOut: '99423059133275237',
        amountIn: '100000000000000000',
        lastOracleTimestamp: '1669314405',
        lastBlockTimestamp: '1669207939',
        skip: true,
        maxSync: "0",
        isSync: true
    },{
        resPair0: '19525000000000000001',
        resPair1: '9762500000000000000',
        resPylon0: '475000000000000009',
        resPylon1: '337490000000000000',
        totalSupply: '13806259902667340413',
        ptb: '6735192090801865169',
        ptTotalSupply: '5099990000000000000',
        gamma: '499999999999999999',
        mu: '499999999999999999',
        vab: '5099990000000000000',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: true,
        isBlocked: false,
        lrkt: '6735192090801865168',
        thisBlockEMA: '0',
        EMABlockNumber: '145',
        strikeBlock: '0',
        lastFloatAccumulator: '142788163609707759770960573309366740',
        blockNumber: '147',
        timestamp: '1669314407',
        lastK: '190612812500000000009762500000000000000',
        price0CumulativeLast: '12980742146337069071326240823050240',
        price1CumulativeLast: '51922968585348276285304963292200960',
        amountOut: '99423059133275237',
        amountIn: '100000000000000000',
        lastOracleTimestamp: '1669314405',
        lastBlockTimestamp: '1669207939',
        skip: true,
        maxSync: "0",
        isSync: true
    },{
        resPair0: '3740000000000000000000',
        resPair1: '9277545527316389833901',
        resPylon0: '85000000000000000000',
        resPylon1: '265000000000000000000',
        totalSupply: '5853249097723417408870',
        ptb: '2851582893762690532526',
        ptTotalSupply: '5300000000000000000000',
        gamma: '500000000000000000',
        mu: '500000000000000000',
        vab: '5300000000000000000000',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: true,
        isBlocked: false,
        lrkt: '2851582893762690532526',
        thisBlockEMA: '0',
        EMABlockNumber: '0',
        strikeBlock: '0',
        lastFloatAccumulator: '0',
        blockNumber: '23',
        timestamp: '1669378581',
        lastK: '34260525000000000000000000000000000000000000',
        price0CumulativeLast: '80938745147748783621210678073136790',
        price1CumulativeLast: '8327268546706799026888531848749210',
        amountOut: '1008592768762259035490',
        amountIn: '467499999999999999999',
        amountIn2: '1159693190914548729237',
        lastOracleTimestamp: '1669378573',
        lastBlockTimestamp: '1669378578',
        skip: true,
        isSync: false
    },
    {
        resPair0: '5148450374000000000000',
        resPair1: '1810376553916521018901',
        resPylon0: '1019626000000000000',
        resPylon1: '1700735085441273357',
        totalSupply: '3034619863702834298130',
        ptb: '29310893296604207966',
        ptTotalSupply: '17162377682770828782',
        gamma: '170012032916891262',
        mu: '170012032916891262',
        vab: '53126889562020704799',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: false,
        isBlocked: false,
        lrkt: '29488146934683536768',
        thisBlockEMA: '329987967083108738',
        EMABlockNumber: '119',
        strikeBlock: '119',
        lastFloatAccumulator: '259772814120933113256755821855685974',
        blockNumber: '217',
        timestamp: '1669483932',
        lastK: '9320633846092343804539714518974000000000000',
        price0CumulativeLast: '259772814120933113256755821855685974',
        price1CumulativeLast: '1456168439292195882333377788389899210',
        amountOut: '921440556100539088072',
        amountIn: '514845000000000000000',
        amountIn2: '180942742031628212017',
        lastOracleTimestamp: '1669483833',
        lastBlockTimestamp: '1669483833',
        skip: false,
        isSync: false
    },
]
