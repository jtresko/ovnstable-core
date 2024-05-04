const { expect } = require("chai");
const {
    transferAsset,
    getERC20,
    transferETH,
    initWallet,
    execTimelock,
    getContract,
    getChainId
} = require("@overnight-contracts/common/utils/script-utils");
const { resetHardhat, greatLess, resetHardhatToLastBlock } = require("@overnight-contracts/common/utils/tests");
const BN = require("bn.js");
const hre = require("hardhat");
const { sharedBeforeEach } = require("@overnight-contracts/common/utils/sharedBeforeEach");
const { toE6, fromE6, fromE18, toAsset, toE18 } = require("@overnight-contracts/common/utils/decimals");
const axios = require("axios");
const { default: BigNumber } = require("bignumber.js");
const { getOdosAmountOut, getOdosSwapData } = require("@overnight-contracts/common/utils/odos-helper");
const { getOdosAmountOutOnly } = require("../../common/utils/odos-helper.js");

async function main() {
    let zap = await getContract('CurveZap');

    let params = {
        name: 'CurveZap',
        gauge: '0xd68089d9daa2da7888b7ef54158480e09ecc3580',
        token0Out: 'usdtPlus',
        token1Out: 'usdPlus',
    }; 

    let setUpParams = await setUp(params);

        console.log("setUp done successfully")

        account = setUpParams.account;

        console.log(account.address);

        token0Out = setUpParams.token0Out;
        token1Out = setUpParams.token1Out;


        // console.log("token0", token0Out.address);
        token0OutDec = await token0Out.decimals();

        // console.log("token1", token1Out.address);
        token1OutDec = await token1Out.decimals();

        toToken0Out = token0OutDec == 6 ? toE6 : toE18;
        toToken1Out = token1OutDec == 6 ? toE6 : toE18;

        fromToken0Out = token0OutDec == 6 ? fromE6 : fromE18;
        fromToken1Out = token1OutDec == 6 ? fromE6 : fromE18;


        const amountToken1Out = toToken1Out(1);
        const amountToken0Out = toToken0Out(1);

        await (await token0Out.approve(zap.address, toE18(10000))).wait();
        await (await token1Out.approve(zap.address, toE18(10000))).wait();

        let reserves;
        if ('pair' in params) {
            reserves = await zap.getProportion(params.pair);
        } else if ('poolId' in params) {
            reserves = await zap.getProportion(params.gauge, params.poolId);
        } else {
            reserves = await zap.getProportion(params.gauge);
        }
        const sumReserves = reserves[0].add(reserves[1]);



    const proportions = calculateProportionForPool({
        inputTokensDecimals: [],
        inputTokensAddresses: [],
        inputTokensAmounts: [],
        inputTokensPrices: [],
        // inputTokensPrices: [await getOdosAmountOutOnly(token0In, dai, token0InDec, account.address), await getOdosAmountOutOnly(token1In, dai, token1InDec, account.address)],
        outputTokensDecimals: [token0OutDec, token1OutDec],
        outputTokensAddresses: [token0Out.address, token1Out.address],
        outputTokensAmounts: [amountToken0Out, amountToken1Out],
        outputTokensPrices: [1, 1],
        proportion0: reserves[0] / sumReserves
    })

    const request = await getOdosRequest({
        "inputTokens": proportions.inputTokens,
        "outputTokens": proportions.outputTokens,
        "userAddr": zap.address,
    });

    const inputTokens = proportions.inputTokens.map(({ tokenAddress, amount }) => {
        return { "tokenAddress": tokenAddress, "amountIn": amount };
    });
    const outputTokens = proportions.outputTokens.map(({ tokenAddress }) => {
        return { "tokenAddress": tokenAddress, "receiver": zap.address };
    });

    let receipt = await (await zap.connect(account).zapIn(
        {
            inputs: inputTokens,
            outputs: outputTokens,
            data: request.data
        },
        {
            amountsOut: [proportions.amountToken0Out, proportions.amountToken1Out],
            ...params,
        }, 
    )).wait();
}

function calculateProportionForPool(
    {
        inputTokensDecimals,
        inputTokensAddresses,
        inputTokensAmounts,
        inputTokensPrices,
        outputTokensDecimals,
        outputTokensAddresses,
        outputTokensAmounts,
        outputTokensPrices,
        proportion0,
    }
) {
    const tokenOut0 = Number.parseFloat(new BigNumber(outputTokensAmounts[0].toString()).div(new BigNumber(10).pow(outputTokensDecimals[0])).toFixed(3).toString()) * outputTokensPrices[0];
    const tokenOut1 = Number.parseFloat(new BigNumber(outputTokensAmounts[1].toString()).div(new BigNumber(10).pow(outputTokensDecimals[1])).toFixed(3).toString()) * outputTokensPrices[1];
    const sumInitialOut = tokenOut0 + tokenOut1;
    let sumInputs = 0;
    for (let i = 0; i < inputTokensAmounts.length; i++) {
        sumInputs += Number.parseFloat(
            new BigNumber(inputTokensAmounts[i].toString())
                .div(new BigNumber(10).pow(inputTokensDecimals[i]))
                .toFixed(3)
                .toString()
        ) * inputTokensPrices[i];
    }
    sumInputs += sumInitialOut;

    const output0InMoneyWithProportion = sumInputs * proportion0;
    const output1InMoneyWithProportion = sumInputs * (1 - proportion0);

    const inputTokens = inputTokensAddresses.map((address, index) => {
        return { "tokenAddress": address, "amount": inputTokensAmounts[index].toString() };
    });
    if (output0InMoneyWithProportion < tokenOut0) {
        const dif = tokenOut0 - output0InMoneyWithProportion;
        const token0AmountForSwap = new BigNumber((dif / outputTokensPrices[0]).toString()).times(new BigNumber(10).pow(outputTokensDecimals[0])).toFixed(0);
        inputTokens.push({ "tokenAddress": outputTokensAddresses[0], "amount": token0AmountForSwap.toString() })

        return {
            "outputTokens": [
                {
                    "tokenAddress": outputTokensAddresses[1],
                    "proportion": 1
                }
            ],
            "inputTokens": inputTokens,
            "amountToken0Out": (new BigNumber(outputTokensAmounts[0]).minus(token0AmountForSwap)).toFixed(0),
            "amountToken1Out": outputTokensAmounts[1].toString(),
        }

    } else if (output1InMoneyWithProportion < tokenOut1) {
        const dif = tokenOut1 - output1InMoneyWithProportion;
        const token1AmountForSwap = new BigNumber((dif / outputTokensPrices[1]).toString()).times(new BigNumber(10).pow(outputTokensDecimals[1])).toFixed(0);
        inputTokens.push({ "tokenAddress": outputTokensAddresses[1], "amount": token1AmountForSwap.toString() })

        return {
            "outputTokens": [
                {
                    "tokenAddress": outputTokensAddresses[0],
                    "proportion": 1
                },
            ],
            "inputTokens": inputTokens,
            "amountToken0Out": outputTokensAmounts[0].toString(),
            "amountToken1Out": (new BigNumber(outputTokensAmounts[1]).minus(token1AmountForSwap)).toFixed(0),
        }

    } else {

        const difToGetFromOdos0 = output0InMoneyWithProportion - tokenOut0;
        const difToGetFromOdos1 = output1InMoneyWithProportion - tokenOut1;

        return {
            "inputTokens": inputTokens,
            "outputTokens": [
                {
                    "tokenAddress": outputTokensAddresses[0],
                    "proportion": Number.parseFloat((difToGetFromOdos0 / (difToGetFromOdos0 + difToGetFromOdos1)).toFixed(2))
                },
                {
                    "tokenAddress": outputTokensAddresses[1],
                    "proportion": Number.parseFloat((difToGetFromOdos1 / (difToGetFromOdos0 + difToGetFromOdos1)).toFixed(2))
                },
            ],
            "amountToken0Out": new BigNumber((tokenOut0 / outputTokensPrices[0]).toString()).times(new BigNumber(10).pow(outputTokensDecimals[0])).toFixed(0),
            "amountToken1Out": new BigNumber((tokenOut1 / outputTokensPrices[1]).toString()).times(new BigNumber(10).pow(outputTokensDecimals[1])).toFixed(0),
        }
    }
}

async function setUp(params) {

    const signers = await hre.ethers.getSigners();
    const account = signers[0];

    let usdc = await getERC20('usdc');

    return {
        account: account,
        token0Out: (await getERC20(params.token0Out)).connect(account),
        token1Out: (await getERC20(params.token1Out)).connect(account)
    }
}

async function getOdosRequest(request) {
    let swapParams = {
        "chainId": await getChainId(),
        "gasPrice": 1,
        "inputTokens": request.inputTokens,
        "outputTokens": request.outputTokens,
        "userAddr": request.userAddr,
        "slippageLimitPercent": 1,
        "sourceBlacklist": ["Hashflow", "Overnight Exchange"],
        "sourceWhitelist": [],
        "simulate": false,
        "pathViz": false,
        "disableRFQs": false
    }

    // @ts-ignore
    const urlQuote = 'https://api.overnight.fi/root/odos/sor/quote/v2';
    const urlAssemble = 'https://api.overnight.fi/root/odos/sor/assemble';
    let transaction;
    try {
        let quotaResponse = (await axios.post(urlQuote, swapParams, { headers: { "Accept-Encoding": "br" } }));

        let assembleData = {
            "userAddr": request.userAddr,
            "pathId": quotaResponse.data.pathId,
            "simulate": true
        }

        // console.log("assembleData: ", assembleData)
        transaction = (await axios.post(urlAssemble, assembleData, { headers: { "Accept-Encoding": "br" } }));
        console.log('trans: ', transaction, quotaResponse);
        // console.log("odos transaction simulation: ", transaction.data.simulation)
    } catch (e) {
        console.log("[zap] getSwapTransaction: ", e);
        return 0;
    }

    if (transaction.statusCode === 400) {
        console.log(`[zap] ${transaction.description}`);
        return 0;
    }

    if (transaction.data.transaction === undefined) {
        console.log("[zap] transaction.tx is undefined");
        return 0;
    }

    
    console.log('Success get data from Odos!');
    return transaction.data.transaction;
}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
