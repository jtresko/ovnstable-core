const { task } = require("hardhat/config");
const fs = require('fs');
const fse = require('fs-extra');
const { TASK_NODE, TASK_COMPILE, TASK_RUN, TASK_TEST } = require('hardhat/builtin-tasks/task-names');
const { evmCheckpoint, evmRestore } = require("./sharedBeforeEach");
const { node_url } = require("./network");
const { fromE18 } = require("./decimals");
const { Provider, Wallet } = require("zksync-ethers");

task('deploy', 'deploy')
    .addFlag('noDeploy', 'Deploy contract|Upgrade proxy')
    .addFlag('setting', 'Run setting contract')
    .addFlag('gov', 'Deploy to local by impression account')
    .addFlag('impl', 'Deploy only implementation without upgradeTo')
    .addOptionalParam('stand', 'Override env STAND')
    .addOptionalParam('token', 'Override env STAND')
    .setAction(async (args, hre) => {

        hre.ovn = args;
    
        // updateFeeData(hre);//todo return

        if (args.reset)
            await evmCheckpoint('task', hre.network.provider);

        try {
            await hre.run('deploy:main', args);
        } catch (e) {
            console.error(e);
        }

        if (args.reset)
            await evmRestore('task', hre.network.provider);
    });


task(TASK_NODE, 'Starts a JSON-RPC server on top of Hardhat EVM')
    .addFlag('reset', 'Reset files')
    .addOptionalParam('stand', 'Override env STAND')
    .addOptionalParam('block', 'Override env STAND')
    .addFlag('last', 'Use last block from RPC')
    .setAction(async (args, hre, runSuper) => {
        
        hre.ovn = args;

        const srcDir = "deployments/" + process.env.standtoken;
        const destDir = "deployments/localhost";

        await fse.removeSync(destDir);  
        await fse.copySync(srcDir, destDir);

        await fs.writeFile('deployments/localhost/.chainId', '31337', function (err) {
            if (err) return console.log(err);
        });

        if (args.last) {

            let nodeUrl = node_url();
            const provider = new hre.ethers.JsonRpcProvider(nodeUrl);
            let block = await provider.getBlockNumber() - 31;

            console.log('Set last block: ' + block);
            await hre.network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: nodeUrl,
                            url: nodeUrl,
                            blockNumber: block,
                            ignoreUnknownTxType: true,
                        },
                    },
                ],
            })
        }

        // I don't know why it is needed
        args.noDeploy = true;

        // need to fix problem "The node was not configured with a hardfork activation history."
        await transferETH(10, "0xcd8562CD85fD93C7e2E80B4Cf69097E5562a76f9");
        await runSuper(args);
    });


task(TASK_RUN, 'Run task')
    .addFlag('reset', 'Reset')
    .addOptionalParam('stand', 'Override env STAND')
    .addOptionalParam('token', 'Override env STAND')
    .setAction(async (args, hre, runSuper) => {
        
        hre.ovn = args;
    
        if (args.reset)
            await evmCheckpoint('task', hre.network.provider);

        await runSuper(args);

        // updateFeeData(hre); // todo return

        if (args.reset)
            await evmRestore('task', hre.network.provider);
    });


task(TASK_COMPILE, 'Compile')
    .addOptionalParam('stand', 'Override env STAND')
    .setAction(async (args, hre, runSuper) => {
        // hre.ovn = args;
        await runSuper(args);
    });


task(TASK_TEST, 'test')
    .addOptionalParam('stand', 'Override env STAND')
    .addOptionalParam('id', 'ETS ID')
    .setAction(async (args, hre, runSuper) => {
        
        hre.ovn = args;

        // enable full deploys
        hre.ovn = {
            impl: false,
            setting: true,
            noDeploy: false,
            deploy: true,
            stand: args.stand,
            id: args.id,
        }

        if (process.env.network === "localhost") {
            if (process.env.stand === "zksync") {
                hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8011')
            } else {
                hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8545')
            }
        }

        await evmCheckpoint('task', hre.network.provider);

        await runSuper(args);

        await evmRestore('task', hre.network.provider);
    });


task('simulate', 'Simulate transaction on local node')
    .addParam('hash', 'Hash transaction')
    .addOptionalParam('stand', 'Stand')
    .setAction(async (args, hre) => {
        
        hre.ovn = args;

        let hash = args.hash;

        console.log(`Simulate transaction by hash: [${hash}]`);
        await evmCheckpoint('simulate', hre.network.provider);
        let nodeUrl = node_url();
        const provider = new hre.ethers.JsonRpcProvider(nodeUrl);

        let receipt = await provider.getTransactionReceipt(hash);
        let transaction = await provider.getTransaction(hash);


        if (process.env.stand === "zksync") {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8011')
        } else {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8545')
        }
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [receipt.from],
        });

        const fromSigner = await hre.ethers.getSigner(receipt.from);
        await transferETH(10, receipt.from, hre);

        if (process.env.stand === "zksync") {
            let {
                maxFeePerGas, maxPriorityFeePerGas
            } = await hre.ethers.provider.getFeeData();
            tx = {
                from: receipt.from,
                to: receipt.to,
                value: 0,
                nonce: await hre.ethers.provider.getTransactionCount(receipt.from, "latest"),
                gasLimit: 15000000,
                maxFeePerGas,
                maxPriorityFeePerGas,
                data: transaction.data
            }

        } else {
            tx = {
                from: receipt.from,
                to: receipt.to,
                value: 0,
                nonce: await hre.ethers.provider.getTransactionCount(receipt.from, "latest"),
                gasLimit: 15000000,
                gasPrice: 150000000000, // 150 GWEI
                data: transaction.data
            }
        }
        await fromSigner.sendTransaction(tx);

        await evmRestore('simulate', hre.network.provider);

    });

task('simulateByData', 'Simulate transaction on local node')
    .addParam('from', 'from')
    .addParam('to', 'to')
    .addParam('data', 'data')
    .setAction(async (args, hre) => {

        let from = args.from;
        let to = args.to;
        let data = args.data;

        console.log(`Simulate transaction from ${from} to ${to} by data: [${data}]`);

        await evmCheckpoint('simulate', hre.network.provider);

        if (process.env.stand === "zksync") {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8011')
        } else {
            hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8545')
        }
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [from],
        });

        const fromSigner = await hre.ethers.getSigner(from);
        await transferETH(100, from, hre);

        let tx
        if (process.env.stand === "zksync") {
            let {
                maxFeePerGas, maxPriorityFeePerGas
            } = await hre.ethers.provider.getFeeData();
            tx = {
                from: from,
                to: to,
                value: 0,
                nonce: await hre.ethers.provider.getTransactionCount(from, "latest"),
                gasLimit: 15000000,
                maxFeePerGas,
                maxPriorityFeePerGas,
                data: data
            }

        } else {
            tx = {
                from: from,
                to: to,
                value: 0,
                nonce: await hre.ethers.provider.getTransactionCount(from, "latest"),
                gasLimit: 15000000,
                gasPrice: 150000000000, // 150 GWEI
                data: data
            }
        }
        await fromSigner.sendTransaction(tx);

        await evmRestore('simulate', hre.network.provider);

    });

function getChainFromNetwork(network) {

    if (network) {

        network = network.toLowerCase();
        for (let chain of Chain.list) {

            // network can be = arbitrum_dai | optimism | base_dai ...
            // chain only = POLYGON|ARBITRUM|BASE ...

            if (network.includes(chain.toLowerCase())){
                return chain;
            }
        }
    }

    throw new Error(`Unknown network: ${network}`)

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    
}



