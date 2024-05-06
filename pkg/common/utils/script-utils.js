const { fromE18, fromE6, toE18, toE6, fromE8 } = require("@overnight-contracts/common/utils/decimals");
const axios = require('axios');
const hre = require("hardhat");
const path = require('path');
const fs = require('fs');
const { ARBITRUM, BASE, BSC, OPTIMISM, POLYGON, LINEA, ZKSYNC, BLAST, getDefault, getAsset, COMMON } = require("./assets");
const { evmCheckpoint, evmRestore } = require("@overnight-contracts/common/utils/sharedBeforeEach");
const BN = require('bn.js');
const { fromAsset, toAsset, fromUsdPlus } = require("./decimals");
const { Wallet, Provider } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { BigNumber } = require("ethers"); 
const DIAMOND_STRATEGY = require('./abi/DiamondStrategy.json');
const { Roles } = require("./roles");
let wallet = undefined;

async function initWallet() {

    // updateFeeData(hre); // todo return

    if (wallet) {
        return wallet;
    }
    
    wallet = await new hre.ethers.Wallet(process.env['PK'], hre.ethers.provider);

    console.log('[User] Wallet: ' + wallet.address);
    const balance = await hre.ethers.provider.getBalance(wallet.address);
    console.log('[User] Balance wallet: ' + fromE18(balance.toString()));

    return wallet;
}

async function findEvent(receipt, abi, eventName) {
    for (let value of receipt.logs) {
        try {
            let log = abi.interface.parseLog(value);

            if (log.name === eventName) {
                return log;
            }
        } catch (e) {}
    }
    return null;
}

async function getWalletAddress() {

    let wallet = await initWallet();

    if (wallet)
        return wallet.address;
    else
        throw new Error('Wallet not found');
}

async function deploySection(exec) {

    if (!hre.ovn.noDeploy) {

        let strategyName = hre.ovn.tags;

        try {
            await exec(strategyName);
            console.log(`[${strategyName}] deploy done`);
        } catch (e) {
            console.error(`[${strategyName}] deploy fail: ` + e);
        }
    }
}

async function settingSection(id, exec) {

    if (hre.ovn.setting) {

        let strategyName = hre.ovn.tags;
        try {
            let strategy = await hre.ethers.getContract(strategyName);

            // ethers by default connect default wallet
            // For ZkSync we should use special zkSync wallet object
            // ZkWallet by default return from initWallet()
            if (process.env.stand === "zksync") {
                strategy = strategy.connect(await initWallet())
            }

            if (hre.ovn.gov) {
                let timelock = await getContract('AgentTimelock');

                if (process.env.stand === "zksync") {
                    hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8011')
                } else {
                    hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8545')
                }
                await hre.network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [timelock.address],
                });
                const timelockAccount = await hre.ethers.getSigner(timelock.address);
                strategy = strategy.connect(timelockAccount);
            }

            console.log('Try to SetStrategyParams');
            let pm = await getContract('PortfolioManager', process.env.standtoken);
            let roleManager = await getContract('RoleManager', process.env.standtoken);
            await (await strategy.setStrategyParams(pm.address, roleManager.address)).wait();
            await exec(strategy);
            try {
                await setDepositor(strategyName, strategy);
            } catch (e) {
                console.log(`SetDepositor fail: ${e}`);
            }

            console.log(`[${strategyName}] setting done`)
        } catch (e) {
            console.error(`[${strategyName}] setting fail: ` + e);
        }
    }
}

async function setDepositor(strategyName, strategy) {

    if (strategyName.includes('Smm') || strategyName.includes('Ets')) {
        console.log('Try to setDepositor');
        let wallet = await initWallet();
        let diamondStrategy = await hre.ethers.getContractAt(DIAMOND_STRATEGY, await strategy.strategy(), wallet);

        if (await diamondStrategy.hasRole(Roles.DEFAULT_ADMIN_ROLE, wallet.address)) {
            await (await diamondStrategy.setDepositor(strategy.address));
            console.log(`diamondStrategy.setDepository(${strategy.address})`);
        } else {
            console.warn(`Cannot setDepositor -> wallet: ${wallet.address} not has ADMIN role on DiamondStrategy: ${diamondStrategy.address}`);
        }
    }
}

async function isContract(address) {
    try {
        const code = await hre.ethers.provider.getCode(address);
        if (code !== '0x') return true;
    } catch (error) {
        return false;
    }
}

async function getContract(name, standtoken = process.env.standtoken) {

    let wallet = await initWallet();

    try {
        let searchPath = fromDir(require('app-root-path').path, path.join(standtoken, name + ".json"));
        console.log(searchPath);
        let contractJson = JSON.parse(fs.readFileSync(searchPath));
        let contract = await hre.ethers.getContractAt(contractJson.abi, contractJson.address, wallet);
        contract.address = await contract.getAddress();
        return contract;
    } catch (e) {
        console.error(`Error: Could not find a contract named [${name}] in folder: [${standtoken}]`);
        throw new Error(e);
    }

}

async function getImplementation(name, network) {

    if (!network)
        network = process.env.standtoken;

    let contractJson;
    try {
        let searchPath = fromDir(require('app-root-path').path, path.join(network, name + ".json"));
        contractJson = JSON.parse(fs.readFileSync(searchPath));
    } catch (e) {
        console.error(`Error: Could not find a contract named [${name}] in network: [${network}]`);
        throw new Error(e);
    }

    if (contractJson.implementation) {
        console.log(`Found implementation: ${contractJson.implementation} for contract: ${name} in network: ${network}`);
        return contractJson.implementation;
    } else {
        throw new Error(`Error: Could not find a implementation for contract [${name}] in network: [${network}]`);
    }
}

async function getERC20(name, wallet) {

    if (!wallet) {
        wallet = await initWallet();
    }

    const ERC20 = require("./abi/IERC20.json");
    return await hre.ethers.getContractAt(ERC20, getAsset(name), wallet);
}

async function getERC20ByAddress(address, wallet) {

    console.log("address in getERC20ByAddress: ", address);

    if (!wallet) {
        wallet = await initWallet();
    }

    const ERC20 = require("./abi/IERC20.json");
    return await hre.ethers.getContractAt(ERC20, address, wallet);
}

async function getCoreAsset() {

    let stand = process.env.standtoken;

    if (stand === 'arbitrum_dai'
        || stand === 'base_dai'
        || stand === 'optimism_dai'
    ) {
        return await getERC20('dai');

    } else if (stand === 'arbitrum_usdt'
        || stand === 'bsc_usdt'
        || stand === 'linea_usdt'
        || stand === 'zksync_usdt'
    ) {
        return await getERC20('usdt');

    } else if (stand === 'base') {
        return await getERC20('usdc');

    } else if (stand === 'arbitrum_eth') {
        return await getERC20('weth');

    } else if (stand === 'base_usdc') {
        return await getERC20('usdc');

    } else if (stand === 'blast') {
        return await getERC20('usdb');

    } else if (stand === 'blast_usdc') {
        return await getERC20('usdb');

    } else {
        return await getERC20('usdc');
    }
}

function fromDir(startPath, filter) {

    if (!fs.existsSync(startPath)) {
        console.log("no dir ", startPath);
        return;
    }

    let files = fs.readdirSync(startPath);
    for (let i = 0; i < files.length; i++) {
        let filename = path.join(startPath, files[i]);
        let stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {
            let value = fromDir(filename, filter); //recurse
            if (value)
                return value;

        } else if (filename.endsWith(filter)) {
            // console.log('Fond: ' + filename)
            return filename;
        }
    }
}

async function getStrategyMapping() {

    let token = process.env.token === "" ? "usd" : process.env.token;
    let url = "https://api.overnight.fi/"+ process.env.stand + "/" + token + "+/dict/strategies";
    
    let strategiesMapping = [];
    try {
        strategiesMapping = (await axios.get(url)).data;
    } catch (e) {
        console.log('Error: ' + e.message);
    }

    return strategiesMapping;
}

async function showM2M(stand = process.env.standtoken, blocknumber) {

    let m2m = await getContract('Mark2Market', stand);
    let usdPlus = await getContract('UsdPlusToken', stand);
    let pm = await getContract('PortfolioManager', stand);

    let strategyAssets;
    let totalNetAssets;
    let strategyWeights;
    if (blocknumber) {
        strategyAssets = await m2m.strategyAssets({ blockTag: blocknumber });
        totalNetAssets = await m2m.totalNetAssets({ blockTag: blocknumber });
        strategyWeights = await pm.getAllStrategyWeights({ blockTag: blocknumber });
    } else {
        strategyAssets = await m2m.strategyAssets();
        totalNetAssets = await m2m.totalNetAssets();
        strategyWeights = await pm.getAllStrategyWeights();
    }

    let strategiesMapping = await getStrategyMapping();

    let sum = 0;

    let items = [];
    for (let i = 0; i < strategyAssets.length; i++) {
        let asset = strategyAssets[i];
        let weight = strategyWeights[i];

        if (weight === undefined) {
            continue;
        }

        let mapping = strategiesMapping.find(value => value.address === asset.strategy);

        items.push(
            {
                name: mapping ? mapping.name : asset.strategy,
                netAssetValue: fromAsset(asset.netAssetValue.toString(), stand),
                liquidationValue: fromAsset(asset.liquidationValue.toString(), stand),
                targetWeight: Number(weight.targetWeight) / 1000,
                maxWeight: Number(weight.maxWeight) / 1000,
                enabled: weight.enabled,
                enabledReward: weight.enabledReward
            });
        sum += parseFloat(fromAsset(asset.netAssetValue.toString(), stand));
    }

    for (let i = 0; i < items.length; i++) {
        items[i].currentWeight = Number((100 * parseFloat(items[i].netAssetValue) / sum).toFixed(3));
    }

    console.table(items);
    console.log('Total m2m:  ' + fromAsset(totalNetAssets.toString(), stand));

    if (usdPlus) {
        let totalUsdPlus = fromUsdPlus(Number(await usdPlus.totalSupply({ blockTag: blocknumber })), stand);
        console.log('Total USD+: ' + totalUsdPlus);
        console.log('Difference is: ',totalUsdPlus - fromAsset(totalNetAssets.toString(), stand));
    }

}

async function getPrice() {
    let params = { gasPrice: "1000000000", gasLimit: "30000000" };
    if (process.env.stand === 'polygon') {
        params = { gasPrice: "60000000000", gasLimit: 15000000 };
    } else if (process.env.stand === 'arbitrum') {
        params = { gasLimit: 25000000 }; // gasPrice always 0.1 GWEI
    } else if (process.env.stand === 'bsc') {
        params = { gasPrice: "3000000000", gasLimit: 15000000 }; // gasPrice always 3 GWEI
    } else if (process.env.stand === "optimism") {
        params = { gasPrice: "1000000000", gasLimit: 10000000 }; // gasPrice always 0.001 GWEI
    } else if (process.env.stand === 'blast') {
        params = { gasLimit: 25000000 }; // todo
    } else if (process.env.stand === 'zksync') {
        let { maxFeePerGas, maxPriorityFeePerGas } = await hre.ethers.provider.getFeeData();
        return { maxFeePerGas, maxPriorityFeePerGas, gasLimit: 200000000 }
    } else if (process.env.stand === 'base') {
        let gasPrice = await hre.ethers.provider.getGasPrice();
        let percentage = gasPrice.mul(BigNumber.from('5')).div(100);
        gasPrice = gasPrice.add(percentage);
        return { gasPrice: gasPrice, gasLimit: 20000000 }
    } else if (process.env.stand === 'linea') {
        let gasPrice = await hre.ethers.provider.getGasPrice();
        let percentage = gasPrice.mul(BigNumber.from('5')).div(100);
        gasPrice = gasPrice.add(percentage);
        return { gasPrice: gasPrice, gasLimit: 20000000 }
    } 

    return params;
}

async function execTimelock(exec) {

    let timelock = (await getContract('AgentTimelock'));
    if (process.env.network === "localhost") {
        if (process.env.stand === "zksync") {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8011')
        } else {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8545')
        }
    }

    await sleep(1000);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [timelock.address],
    });

    await checkTimeLockBalance(); 

    const timelockAccount = await hre.ethers.getSigner(timelock.address);

    await exec(timelockAccount);

    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [timelock.address],
    });
}

async function checkTimeLockBalance() {

    let timelock = await getContract('AgentTimelock');

    const balance = await hre.ethers.provider.getBalance(timelock.address);

    if (new BN(balance.toString()).lt(new BN("10000000000000000000"))) {
        await transferETH(10, timelock.address);
    }
}

async function getChainId() {

    switch (process.env.stand) {
        case "arbitrum":
            return 42161;
        case "base":
            return 8453;
        case "bsc":
            return 56;
        case "optimism":
            return 10;
        case "polygon":
            return 137;
        case "zksync":
            return 324;
        case "linea":
            return 59144;
        case "blast":
            return 81457;
        default:
            throw new Error("Unknown chain");
    }
}

async function transferETH(amount, to) {
    if (process.env.stand === "zksync") {
        let provider = new Provider("http://localhost:8011");
        let wallet = new Wallet('0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110', provider, hre.ethers.provider);
        console.log(`Balance [${fromE18(await provider.getBalance(wallet.address))}]:`);

        await wallet.transfer({
            to: to,
            token: '0x0000000000000000000000000000000000000000',
            amount: hre.ethers.parseEther(amount + ""),
        });
    } else {
        let privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Ganache key
        let walletWithProvider = new hre.ethers.Wallet(privateKey, hre.ethers.provider);

        // вернул как было. у меня не работала почему-то твоя версия
        await walletWithProvider.sendTransaction({
            to: to,
            value: hre.ethers.parseEther(amount + "")
        });
    }

    console.log(`[Node] Transfer ETH [${fromE18(await hre.ethers.provider.getBalance(to))}] to [${to}]`);
}

async function transferAsset(assetAddress, to, amount) {

    let from;
    switch (process.env.stand) {
        case "arbitrum":
            switch (assetAddress) {
                case ARBITRUM.dai:
                    from = "0x2d070ed1321871841245d8ee5b84bd2712644322";
                    break;
                case ARBITRUM.weth:
                    from = "0x1eed63efba5f81d95bfe37d82c8e736b974f477b";
                    break;
                case ARBITRUM.usdc:
                    from = '0x62383739D68Dd0F844103Db8dFb05a7EdED5BBE6';
                    break;
                case ARBITRUM.usdcCircle:
                    from = '0xe68ee8a12c611fd043fb05d65e1548dc1383f2b9';
                    break;
                case ARBITRUM.usdt:
                    from = '0x8f9c79b9de8b0713dcac3e535fc5a1a92db6ea2d';
                    break;
                case ARBITRUM.wstEth:
                    from = "0x916792f7734089470de27297903bed8a4630b26d";
                    break;
                case ARBITRUM.fraxbp:
                    from = "0x7D94283d7C15B87aeD6a296C3d1c2Fb334509907";
                    break;
                case ARBITRUM.usdtPlus:
                    from = "0xc5543b3a2973dd3b9d156376e1e8e7d0dcac3664";
                    break;
                case ARBITRUM.usdPlus:
                    from = "0x036b8593b217ceaA9A2B46ca52d3Dc2bAFAA29AB";
                    break;
                case ARBITRUM.frax:
                    from = '0x9cd4fF80d81E4dDA8E9D637887a5dB7E0c8e007B';
                    break; 
                default:
                    throw new Error('Unknown asset address');
            }
            break;
        case "base":
            switch (assetAddress) {
                case BASE.usdbc:
                    from = '0x806b9e17306cb97e93bb6c64ee9c9c318e5a0327';
                    break;
                case BASE.usdc:
                    from = '0x20fe51a9229eef2cf8ad9e89d91cab9312cf3b7a';
                    break;
                case BASE.dai:
                    from = '0x428AB2BA90Eba0a4Be7aF34C9Ac451ab061AC010';
                    break;
                case BASE.crvUsd:
                    from = '0x9f1920d0cbb63ed03376a1e09fd2851d601234c8';
                    break;
                case BASE.dola:
                    from = '0x7944642920Df33BAE461f86Aa0cd0b4B8284330E';
                    break;
                case BASE.sfrax:
                    from = '0x6e74053a3798e0fC9a9775F7995316b27f21c4D2';
                    break;
                case BASE.ovn:
                    from = '0xf02d9f19060eE2dd50047dC6E1E9eBAC9bA436FE';
                    break
                case BASE.aero:
                    from = '0x082Bdc61Fe48aE3C35700e345576c03f62fF4483';
                    break
                case BASE.eusd:
                    from = '0x7a8e66c3c704c11b5e2a0ac9bcb8466c009b6afc';
                    break
                case BASE.wstEth:
                    from = '0x31b7538090c8584fed3a053fd183e202c26f9a3e';
                    break
                default:
                    throw new Error('Unknown asset address');
            }
            break;
        case "bsc":
            switch (assetAddress) {
                case BSC.usdc:
                    from = '0x8894e0a0c962cb723c1976a4421c95949be2d4e3';
                    break;
                case BSC.usdt:
                    from = '0x4b16c5de96eb2117bbe5fd171e4d203624b014aa';
                    break;
                default:
                    throw new Error('Unknown asset address');
            }
            break;
        case "linea":
            switch (assetAddress) {
                case LINEA.usdc:
                    from = '0x555ce236c0220695b68341bc48c68d52210cc35b';
                    break;
                case LINEA.usdt:
                    from = '0xd7aa9ba6caac7b0436c91396f22ca5a7f31664fc';
                    break;
                case LINEA.usdPlus:
                    from = '0x12a79e67ed7f4fd0a0318d331941800898dab30d';
                    break;
                case LINEA.dai:
                    from = '0x428ab2ba90eba0a4be7af34c9ac451ab061ac010';
                    break;
                case LINEA.usdtPlus:
                    from = '0x9030d5c596d636eefc8f0ad7b2788ae7e9ef3d46';
                    break;
                default:
                    throw new Error('Unknown asset address');
            }
            break;
        case "optimism":
            switch (assetAddress) {
                case OPTIMISM.usdc:
                    from = '0xebe80f029b1c02862b9e8a70a7e5317c06f62cae';
                    break;
                case OPTIMISM.dai:
                    from = '0x7b7b957c284c2c227c980d6e2f804311947b84d0';
                    break;
                case OPTIMISM.usdt:
                    from = '0x0d0707963952f2fba59dd06f2b425ace40b492fe';
                    break;
                case OPTIMISM.wbtc:
                    from = '0xa4cff481cd40e733650ea76f6f8008f067bf6ef3';
                    break;
                case OPTIMISM.ovn:
                    from = '0xe4e83f7083d3f9260285691aaa47e8c57078e311';
                    break;
                default:
                    throw new Error('Unknown asset address');
            }
            break;
        case "polygon":
            switch (assetAddress) {
                case POLYGON.usdc:
                    from = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245';
                    break;
                case POLYGON.dai:
                    from = '0xdfD74E3752c187c4BA899756238C76cbEEfa954B';
                    break;
                default:
                    throw new Error('Unknown asset address');
            }
            break;
        case "zksync":
            switch (assetAddress) {
                case ZKSYNC.usdc:
                    from = "0x6b6314f4f07c974600d872182dcDE092C480e57b";
                    break;
                case ZKSYNC.usdt:
                    from = "0x7FcBd9d429932A11884Cb5CE9c61055b369F56F7";
                    break;
                case ZKSYNC.weth:
                    from = "0x6b6314f4f07c974600d872182dcDE092C480e57b";
                    break;
            }
            break;
        case "blast":
            switch (assetAddress) {
                case BLAST.usdb:
                    from = '0x15c59df002950e3b7e287de9c0c91aa63e8d9937';
                    break;
                default:
                    throw new Error('Unknown asset address');
            }
            break; 
        default:
            throw new Error('Unknown mapping stand');
    }

    await transferETH(1, from);

    let asset = await getERC20ByAddress(assetAddress);

    if (process.env.network === 'localhost') {
        if (process.env.stand === "zksync") {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8011')
        } else {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8545')
        }
    }

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [from],
    });

    let account = await hre.ethers.getSigner(from);

    if (!amount) {
        amount = await asset.balanceOf(from);
    }
    await asset.connect(account).transfer(to, amount, await getPrice());
    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [from],
    });

    let balance = await asset.balanceOf(to);

    let symbol = await asset.symbol();

    let fromAsset = (await asset.decimals()) === 18 ? fromE18 : fromE6;
    console.log(`[Node] Transfer asset: [${symbol}] balance: [${fromAsset(balance)}] from: [${from}] to: [${to}]`);
}

async function showPayoutEvent(receipt, exchange) {

    if (!exchange) {
        exchange = await getContract('Exchange');
    }

    let event = await findEvent(receipt, exchange, 'PayoutEvent');

    if (event) {
        console.log('Profit:       ' + fromUsdPlus(await event.args[0].toString()));
        console.log('ExcessProfit: ' + fromUsdPlus(await event.args[2].toString()));
        console.log('Premium:      ' + fromUsdPlus(await event.args[3].toString()));
        console.log('Loss:         ' + fromUsdPlus(await event.args[4].toString()));
    }
}

async function transferDAI(to) {

    let address;
    switch (process.env.stand) {
        case "optimism":
            address = '0x7b7b957c284c2c227c980d6e2f804311947b84d0';
            break
        case "polygon":
            address = '0xdfD74E3752c187c4BA899756238C76cbEEfa954B';
            break
        default:
            throw new Error('Unknown mapping stand');
    }

    await transferETH(1, address);

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address],
    });

    const account = await hre.ethers.getSigner(address);

    let token = await getERC20('dai');

    await token.connect(account).transfer(to, await token.balanceOf(account.address));

    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [account.address],
    });

    console.log(`[Node] Transfer DAI [${fromE18(await token.balanceOf(to))}] to [${to}]:`);
}

async function transferUSDC(amount, to) {

    let address;
    if (process.env.stand == 'polygon') {
        address = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245';
    } else if (process.env.stand == 'optimism') {
        address = '0xd6216fc19db775df9774a6e33526131da7d19a2c';
    } else {
        throw new Error(`Unknown holder for chain: [${process.env.stand}]`);
    }

    await transferETH(1, address);

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address],
    });


    const account = await hre.ethers.getSigner(address);

    let usdc = await getERC20('usdc');

    await usdc.connect(account).transfer(to, await usdc.balanceOf(account.address));

    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [account.address],
    });

    console.log(`[Node] Transfer USDC [${fromE6(await usdc.balanceOf(to))}] to [${to}]:`);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateFeeData(hre) {

    // TODO network: 'localhost' should use default hardhat ether provider for support reset/snapshot functions
    if (process.env.network === "main") {
        let url = node_url();
        // let provider = new hre.ethers.StaticJsonRpcProvider(url);

        let getFeeData = async function () {
            if (process.env.stand === "zksync") {
                let {
                    maxFeePerGas, maxPriorityFeePerGas
                } = await hre.ethers.provider.getFeeData();

                return { maxFeePerGas, maxPriorityFeePerGas }

            } else {
                let gasPrice = await hre.ethers.provider.getGasPrice();
                console.log(`Get gasPrice: ${gasPrice.toString()}`);
                return {
                    gasPrice: gasPrice
                }
            }
        };

        // By default hre.ethers.provider is proxy object.
        // Hardhat recreate proxy by events but for real chains we override it
        hre.ethers.provider = new hre.ethers.BrowserProvider(hre.network.provider);
        hre.ethers.provider.getFeeData = getFeeData;
    }

}

module.exports = {
    getStrategyMapping: getStrategyMapping,
    getChainId: getChainId,
    initWallet: initWallet,
    getWalletAddress: getWalletAddress,
    transferETH: transferETH,
    sleep: sleep,
    transferDAI: transferDAI,
    transferUSDC: transferUSDC,
    transferAsset: transferAsset,
    showM2M: showM2M,
    getPrice: getPrice,
    getContract: getContract,
    findEvent: findEvent,
    isContract: isContract,
    getImplementation: getImplementation,
    getERC20: getERC20,
    getERC20ByAddress: getERC20ByAddress,
    getCoreAsset: getCoreAsset,
    execTimelock: execTimelock,
    deploySection: deploySection,
    settingSection: settingSection,
    checkTimeLockBalance: checkTimeLockBalance,
    showPayoutEvent: showPayoutEvent,
    updateFeeData: updateFeeData
}