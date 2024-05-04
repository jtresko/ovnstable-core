const dotenv = require('dotenv');
dotenv.config();

const { expect } = require('chai');
const hre = require("hardhat");
const fs = require('fs-extra');
const { node_url, blockNumber } = require('../utils/network');
const { transferETH, getERC20, transferAsset, execTimelock, getContract, getChainId, initWallet } = require('./script-utils');
const HedgeExchangerABI = require('./abi/HedgeExchanger.json');
const InchSwapperABI = require('./abi/InchSwapper.json');
const StakerABI = require('./abi/Staker.json');
const { Roles } = require('./roles');
const { ARBITRUM, OPTIMISM, BSC, getAsset, BASE, BLAST } = require('./assets');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { getDataForSwap } = require('./inch-helpers');

const DIAMOND_STRATEGY = require('./abi/DiamondStrategy.json');
const WRAPPER_DIAMOND_STRATEGY = require('./abi/WrapperDiamondStrategy.json');

let isTestAssetsCompleted = false;

function greatLess(value, expected, delta) {
    let maxValue = expected.plus(delta);
    let minValue = expected.minus(delta);

    expect(value.gte(minValue)).to.equal(true);
    expect(value.lte(maxValue)).to.equal(true);
}

async function resetHardhat() {
    let block = blockNumber();
    let url = node_url();
    if (block == 0) {
        const provider = new hre.ethers.JsonRpcProvider(url);
        block = (await provider.getBlockNumber()) - 31;
    }

    await hre.network.provider.request({
        method: 'hardhat_reset',
        params: [
            {
                forking: {
                    jsonRpcUrl: url,
                    blockNumber: block,
                },
            },
        ],
    });

    console.log(`[Hardhat]: hardhat_reset -> ${block.toString()}`);
}

async function resetHardhatToLastBlock() {
    const provider = new hre.ethers.JsonRpcProvider(node_url());
    let block = (await provider.getBlockNumber()) - 31;

    await hre.network.provider.request({
        method: 'hardhat_reset',
        params: [
            {
                forking: {
                    jsonRpcUrl: node_url(),
                    blockNumber: block,
                },
            },
        ],
    });

    console.log(`[Hardhat]: hardhat_reset -> ${block.toString()}`);
}

async function setStrategyAsDepositor(strategyAddress) {
    console.log(`Set depositor: ${strategyAddress}`);
    let wallet = await initWallet();

    await transferETH(1, wallet.address);

    let wrapperStrategy = await hre.ethers.getContractAt(WRAPPER_DIAMOND_STRATEGY, strategyAddress, wallet);

    let diamondStrategyAddress = await wrapperStrategy.strategy();
    let diamondStrategy = await hre.ethers.getContractAt(DIAMOND_STRATEGY, diamondStrategyAddress, wallet);

    await execTimelock(async timelock => {
        if (await diamondStrategy.hasRole(Roles.DEFAULT_ADMIN_ROLE, wallet.address)) {
            await diamondStrategy.connect(wallet).setDepositor(strategyAddress);
        } else {
            await diamondStrategy.connect(timelock).setDepositor(strategyAddress);
        }
    });

    console.log('Set depositor done()');
}

async function impersonatingEtsGrantRole(hedgeExchangerAddress, ownerAddress, strategyAddress) {
    await transferETH(1, ownerAddress);
    console.log('Execute: [impersonatingEtsGrantRole]');
    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [ownerAddress],
    });
    const owner = await hre.ethers.getSigner(ownerAddress);
    let hedgeExchanger = await hre.ethers.getContractAt(HedgeExchangerABI, hedgeExchangerAddress);
    await hedgeExchanger.connect(owner).grantRole(Roles.PORTFOLIO_AGENT_ROLE, ownerAddress);
    await hedgeExchanger.connect(owner).grantRole(Roles.WHITELIST_ROLE, strategyAddress);
    await hedgeExchanger.connect(owner).grantRole(Roles.FREE_RIDER_ROLE, strategyAddress);
    if (process.env.stand === "arbitrum") {
        await hedgeExchanger.connect(owner).setBlockGetter(ZERO_ADDRESS);
    }
    await hre.network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [ownerAddress],
    });
}

async function impersonatingEtsGrantRoleWithInchSwapper(
    hedgeExchangerAddress,
    strategyAddress,
    ownerAddress,
    inchSwapperAddress,
    asset,
    underlyingAsset,
    amountInMax0,
    amountInMax1,
) {
    console.log('Execute: [impersonatingEtsGrantRoleWithInchSwapper]');
    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [ownerAddress],
    });
    const owner = await hre.ethers.getSigner(ownerAddress);

    let inchSwapper = await hre.ethers.getContractAt(InchSwapperABI, inchSwapperAddress);
    let hedgeExchanger = await hre.ethers.getContractAt(HedgeExchangerABI, hedgeExchangerAddress);
    let hedgeExchangeAdmin;
    let DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (await hedgeExchanger.hasRole(DEFAULT_ADMIN_ROLE, owner.address)) {
        hedgeExchangeAdmin = owner;
    } else {
        await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: ['0x66BC0120b3287f08408BCC76ee791f0bad17Eeef'],
        });
        hedgeExchangeAdmin = await hre.ethers.getSigner('0x66BC0120b3287f08408BCC76ee791f0bad17Eeef');
    }
    await hedgeExchanger.connect(hedgeExchangeAdmin).grantRole(Roles.PORTFOLIO_AGENT_ROLE, ownerAddress);
    await hedgeExchanger.connect(hedgeExchangeAdmin).grantRole(Roles.WHITELIST_ROLE, strategyAddress);
    await hedgeExchanger.connect(hedgeExchangeAdmin).grantRole(Roles.FREE_RIDER_ROLE, strategyAddress);
    if (process.env.stand === "arbitrum") {
        await inchSwapper.connect(owner).setParams(ARBITRUM.inchRouterV5, ZERO_ADDRESS);
        await hedgeExchanger.connect(hedgeExchangeAdmin).setBlockGetter(ZERO_ADDRESS);
    }

    let inchDataForSwapResponse0 = await getDataForSwap(await getChainId(), owner.address, asset, underlyingAsset, amountInMax0, '', '');

    await inchSwapper.connect(owner).updatePath(
        {
            tokenIn: asset,
            tokenOut: underlyingAsset,
            amount: amountInMax0,
            flags: inchDataForSwapResponse0.flags,
            srcReceiver: inchDataForSwapResponse0.srcReceiver,
        },
        inchDataForSwapResponse0.data,
    );

    let inchDataForSwapResponse1 = await getDataForSwap(await getChainId(), owner.address, underlyingAsset, asset, amountInMax1, '', '');

    await inchSwapper.connect(owner).updatePath(
        {
            tokenIn: underlyingAsset,
            tokenOut: asset,
            amount: amountInMax1,
            flags: inchDataForSwapResponse1.flags,
            srcReceiver: inchDataForSwapResponse1.srcReceiver,
        },
        inchDataForSwapResponse1.data,
    );

    await hre.network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [ownerAddress],
    });
}

async function impersonatingStaker(stakerAddress, ownerAddress, strategyAddress, pair, gauge) {
    console.log('Execute: [impersonatingStaker]');
    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [ownerAddress],
    });

    await transferETH(1, ownerAddress);
    const owner = await hre.ethers.getSigner(ownerAddress);
    let staker = await hre.ethers.getContractAt(StakerABI, stakerAddress);
    await staker.connect(owner).whitelistStrategy(strategyAddress, pair, gauge);

    await hre.network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [ownerAddress],
    });
}

async function prepareArtifacts() {
    const srcDir = `./artifacts-external`;
    const destDir = `./artifacts`;

    await fs.copy(srcDir, destDir, function (err) {
        if (err) {
            console.log('An error occurred while copying the folder.');
            return console.error(err);
        }
    });
}

async function createRandomWallet() {
    let wallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
    await transferETH(1, wallet.address);
    return wallet;
}

async function getTestAssets(to) {

    let stand = process.env.standtoken;
    if (isTestAssetsCompleted) {
        return;
    }

    if (stand === 'optimism_dai') {
        await transferAsset(OPTIMISM.dai, to);
    } else if (stand === 'arbitrum_dai') {
        await transferAsset(ARBITRUM.dai, to);
    } else if (stand === 'arbitrum_eth') {
        await transferAsset(ARBITRUM.weth, to);
    } else if (stand === 'bsc_usdt') {
        await transferAsset(BSC.usdt, to);
    } else if (stand === 'arbitrum_usdt') {
        await transferAsset(ARBITRUM.usdt, to);
    } else if (stand === 'base_dai') {
        await transferAsset(BASE.dai, to);
    } else if (stand === 'blast') {
        await transferAsset(BLAST.usdb, to);
    } else if (stand === 'blast_usdc') {
        await transferAsset(BLAST.usdb, to);
    } else {
        await transferAsset(getAsset('usdc'), to);
    }

    isTestAssetsCompleted = true;
}

async function prepareEnvironment() {
    if (process.env.stand === "arbitrum") {
        await execTimelock(async timelock => {
            let exchange = await getContract('Exchange', process.env.standtoken);
            await exchange.connect(timelock).setBlockGetter(ZERO_ADDRESS);
            console.log('[Test] exchange.setBlockGetter(zero)');

            try {
                let inchSwapper = await getContract('InchSwapper', process.env.standtoken);
                let roleManager = await getContract('RoleManager', process.env.standtoken);
                await inchSwapper.connect(timelock).setParams(await getAsset('inchRouterV5'), ZERO_ADDRESS, roleManager.address);
                console.log('[Test] inchSwapper.setBlockGetter(zero)');
            } catch (e) {
                console.log(`Cannot sen blockGetter: ${e}`);
            }
        });
    }
}

module.exports = {
    greatLess: greatLess,
    setStrategyAsDepositor: setStrategyAsDepositor,
    resetHardhat: resetHardhat,
    resetHardhatToLastBlock: resetHardhatToLastBlock,
    prepareEnvironment: prepareEnvironment,
    prepareArtifacts: prepareArtifacts,
    createRandomWallet: createRandomWallet,
    getTestAssets: getTestAssets,
    impersonatingEtsGrantRole: impersonatingEtsGrantRole,
    impersonatingStaker: impersonatingStaker,
    impersonatingEtsGrantRoleWithInchSwapper: impersonatingEtsGrantRoleWithInchSwapper,
};
