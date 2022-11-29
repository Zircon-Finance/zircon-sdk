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
    amountOut2?: string // For Burn Async Case
    amountIn: string
    amountIn2?: string // For Async use case
    lastOracleTimestamp: string
    lastBlockTimestamp: string
    skip: boolean
    maxSync?: string
    isSync: boolean
    isBurn: boolean
    reservePtEnergy?: string
    reserveAnchorEnergy?: string
}


export const CASES: TestInput[] = [
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
        isSync: true,
        isBurn: false
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
        isSync: true,
        isBurn: false

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
        isSync: true,
        isBurn: false
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
        isSync: true,
        isBurn: false

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
        isSync: true,
        isBurn: false

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
        isSync: false,
        isBurn: false

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
        skip: true,
        isSync: false,
        isBurn: false
    },{
        resPair0: '230407800000000000000000',
        resPair1: '1690987695225219037951',
        resPylon0: '8403871247775129440439',
        resPylon1: '166478929345198836631',
        totalSupply: '19726329037083275572250',
        ptb: '19518929439509439603394',
        ptTotalSupply: '122387392958001549360000',
        gamma: '250876043432098618',
        mu: '250876043432098618',
        vab: '3501256362692732336985',
        gEMA: '7785600728316546',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: false,
        isBlocked: false,
        lrkt: '19531182291688716530822',
        thisBlockEMA: '0',
        EMABlockNumber: '171',
        strikeBlock: '71',
        lastFloatAccumulator: '6463864451993343495539564832867345',
        blockNumber: '220',
        timestamp: '1669483932',
        lastK: '389616754683913223052406417800000000000000000',
        price0CumulativeLast: '6463864451993343495541155374457945',
        price1CumulativeLast: '107187446633368098116057237221019142040',
        amountOut: '1202425863659095931261',
        amountIn: '1200000000000000000000',
        lastOracleTimestamp: '1669556477',
        lastBlockTimestamp: '1669556477',
        skip: true,
        isSync: true,
        isBurn: true
    },{
        resPair0: '1846818181818181818181',
        resPair1: '5757727272727272727272',
        resPylon0: '7727272727272727273',
        resPylon1: '24090909090909090909',
        totalSupply: '3260901012484607833844',
        ptb: '259234808523880957500',
        ptTotalSupply: '154545454545454545454',
        gamma: '500000000000000000',
        mu: '500000000000000000',
        vab: '481818181818181818181',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: false,
        isBlocked: false,
        lrkt: '259234808523880957499',
        thisBlockEMA: '0',
        EMABlockNumber: '0',
        strikeBlock: '0',
        lastFloatAccumulator: '0',
        blockNumber: '20',
        timestamp: '1669562139',
        lastK: '10633475413223140495861714586776859504132232',
        price0CumulativeLast: '48563247088649270172726406843882074',
        price1CumulativeLast: '4996361128024079416133119109249526',
        amountOut: '151511178585388993162',
        amountIn: '154545454545454544454',
        lastOracleTimestamp: '1669562135',
        lastBlockTimestamp: '1669562138',
        skip: true,
        isSync: true,
        isBurn: true
    },{
        resPair0: '3292456277192971839849',
        resPair1: '10878250000000000000003',
        resPylon0: '80749999999999999999',
        resPylon1: '463898782999999999997',
        totalSupply: '5860753263233319226062',
        ptb: '2859087059272592349718',
        ptTotalSupply: '5512148783000000000000',
        gamma: '499999999999999999',
        mu: '499999999999999999',
        vab: '5512148783000000000000',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: true,
        isBlocked: false,
        lrkt: '2859087059272592349718',
        thisBlockEMA: '0',
        EMABlockNumber: '0',
        strikeBlock: '0',
        lastFloatAccumulator: '890326196625236619833477789107377440',
        blockNumber: '124',
        timestamp: '1669568736',
        lastK: '34348428812500000000020306000000000000000003',
        price0CumulativeLast: '944085153418145989310617846845261534',
        price1CumulativeLast: '99974001927689681291333817240529312',
        amountOut: '5410759295958890653',
        amountIn: '5303719575000000000',
        lastOracleTimestamp: '1669568683',
        lastBlockTimestamp: '1669568687',
        skip: true,
        isSync: true,
        isBurn: true
    },{
        resPair0: '9501834316141826786',
        resPair1: '19499899463992297503',
        resPylon0: '1',
        resPylon1: '500000000000000000',
        totalSupply: '13611805542260445970',
        ptb: '6540737725975564672',
        ptTotalSupply: '10000000000000000000',
        gamma: '499999999999999999',
        mu: '499999999999999999',
        vab: '10000000000000000000',
        gEMA: '0',
        akv: '1000334198890909740',
        fs: true,
        isAnchor: true,
        isBlocked: false,
        lrkt: '6540800629155129164',
        thisBlockEMA: '1',
        EMABlockNumber: '21',
        strikeBlock: '0',
        lastFloatAccumulator: '51922968585348276287491193548426150',
        blockNumber: '22',
        timestamp: '1669577645',
        lastK: '185284813888277626841987663231606315358',
        price0CumulativeLast: '51922968585348276285304963292200960',
        price1CumulativeLast: '12980742146337069071326240823050240',
        amountOut: '996330078632401173',
        amountIn: '999999999999999900',
        lastOracleTimestamp: '1669577644',
        lastBlockTimestamp: '1669568687',
        skip: true,
        isSync: true,
        isBurn: true
    },{
        resPair0: '1605877053830859948961',
        resPair1: '5985714495842668712945',
        resPylon0: '850000000000000000',
        resPylon1: '2989354000000000000',
        totalSupply: '3091750101141879429676',
        ptb: '88365496302484555779',
        ptTotalSupply: '264678131634198565281',
        gamma: '234637112306519176',
        mu: '234637112306519176',
        vab: '264862961354252293182',
        gEMA: '26050464954836787',
        akv: '1847598563028138767',
        fs: true,
        isAnchor: true,
        isBlocked: false,
        lrkt: '88611988551742361821',
        thisBlockEMA: '73293156719397408',
        EMABlockNumber: '175',
        strikeBlock: '175',
        lastFloatAccumulator: '2869551848274905324353587593940104176',
        blockNumber: '271',
        timestamp: '1669645607',
        lastK: '9612321559656496024910377124608514260000145',
        price0CumulativeLast: '953539010696711077492836607845650272',
        price1CumulativeLast: '103918761109341480609943402929775224',
        amountOut: '283069099226639042',
        amountOut2: '1055106184202617539',
        amountIn: '2115085050876080948',
        lastOracleTimestamp: '1669645510',
        lastBlockTimestamp: '1669645411',
        skip: false,
        isSync: false,
        isBurn: true,
        reservePtEnergy: '39290630168703357',
        reserveAnchorEnergy: "508920125865029644"
    },{
        resPair0: '9945000037400000000000',
        resPair1: '3548762163917737017398',
        resPylon0: '85016962600000000000',
        resPylon1: '168141630371739861511',
        totalSupply: '5935725320948289769078',
        ptb: '2933082924429155792423',
        ptTotalSupply: '1700016344367248280300',
        gamma: '170794619634480087',
        mu: '170794619634480087',
        vab: '5301756222276057887873',
        gEMA: '0',
        akv: '1000000000000000000',
        fs: true,
        isAnchor: false,
        isBlocked: false,
        lrkt: '2935562881646341841982',
        thisBlockEMA: '329205380365519913',
        EMABlockNumber: '598',
        strikeBlock: '598',
        lastFloatAccumulator: '84543231682941336888688493402634026',
        blockNumber: '647',
        timestamp: '1669646702',
        lastK: '35292439852885599568546474450685200000000000',
        price0CumulativeLast: '84543231682941336888688493402634026',
        price1CumulativeLast: '38245478981314986570692294288047768',
        amountOut: '293062249123069578368',
        amountOut2: '104575989688229392681',
        amountIn: '566672114789082759766',
        lastOracleTimestamp: '1669646652',
        lastBlockTimestamp: '1669646652',
        skip: false,
        isSync: false,
        isBurn: true,
        reservePtEnergy: '380401349474472200',
        reserveAnchorEnergy: "10660602865611"
    },
]
