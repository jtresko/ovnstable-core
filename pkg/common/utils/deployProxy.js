const hre = require("hardhat");
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const sampleModule = require('@openzeppelin/hardhat-upgrades/dist/utils/deploy-impl');
const { getContract, checkTimeLockBalance, initWallet, sleep, getPrice } = require("./script-utils");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { isZkSync } = require("./network");

async function deployProxy(contractName, deployments, save, params) {

    if (isZkSync()) {

        params = params ? params : {};

        return deployProxyZkSync(contractName, contractName, deployments, save, params);
    } else {
        return deployProxyEth(contractName, contractName, deployments, save, params);
    }
}

async function deployProxyMulti(contractName, factoryName, deployments, save, params) {

    if (isZkSync()) {

        params = params ? params : {};

        return deployProxyZkSync(contractName, factoryName, deployments, save, params);
    } else {
        return deployProxyEth(contractName, factoryName, deployments, save, params);
    }
}


/**
 * Chain ZkSync not support by OpenZeppelin plugin for deploy proxy contracts.
 * That's why it must deploy by self.
 * How to deploy?
 * - Deploy ERC1967Proxy contract
 * - Deploy Implementation contract
 * - Execute on ERC1967Proxy function: upgradeTo(pass Implementation contract address)
 *
 * This is the implementation support next cases:
 * 1) primary deploy (proxy not exist)
 * 2) update existed proxy
 *
 * !!!! Important
 * This method not make verify storage current implementation and deploying implementation
 * YOU MUST BE SURE OF CORRECTNESS STORAGE_LAYOUT
 */

async function deployProxyZkSync(contractName, factoryName, deployments, save, params) {

    if (hre.ovn === undefined)
        hre.ovn = {};

    const deployer = new Deployer(hre, await initWallet());


    let proxyExist = true;

    let proxy;
    try {
        proxy = await hre.ethers.getContract(contractName);
    } catch (e) {
        console.log(`${contractName}: Proxy not found: ` + e);
        proxyExist = false;
    }

    if (proxyExist) {

        console.log(`${contractName}: Proxy found at` + proxy.address);

        let implArtifact = await deployer.loadArtifact(factoryName);

        const implContract = await deployer.deploy(implArtifact, []);
        console.log(`${contractName}: New implementation deployed at ${implContract.address}`);

        let wallet = await initWallet();
        proxy = proxy.connect(wallet);
        // let price = await getPrice();
        // Execute this method can be not working when test it on local node


        if (!hre.ovn.impl) {
            await (await proxy.upgradeTo(implContract.address)).wait();
            console.log(`${contractName}: Proxy ${proxy.address} upgradeTo ${implContract.address}`);
        }


        await save(contractName, {
            address: proxy.address,
            implementation: implContract.address,
            ...implArtifact
        });

        console.log(`${contractName}: Update deployments`);

    } else {
        let implArtifact = await deployer.loadArtifact(factoryName);

        const implContract = await deployer.deploy(implArtifact, []);
        console.log(`${contractName} deployed at ${implContract.address}`);

        await sleep(30000)

        let proxyArtifact = await deployer.loadArtifact('ERC1967Proxy');

        let initializeData = implContract.interface.getFunction('initialize');
        let implAddress = implContract.address;

        let args = params.args ? params.args : [];
        let implData = implContract.interface.encodeFunctionData(initializeData, args);

        const proxy = await deployer.deploy(proxyArtifact, [implAddress, implData]);

        console.log(`Proxy ${contractName} deployed at ${proxy.address}`);

        await save(contractName, {
            address: proxy.address,
            implementation: implAddress,
            ...implArtifact
        });

        console.log(`Save ${implArtifact.contractName} to deployments`);
    }
}

async function deployProxyEth(contractName, factoryName, deployments, save, params) {

    if (hre.ovn === undefined)
        hre.ovn = {};

    let factoryOptions;
    let unsafeAllow;
    let args;
    if (params) {
        factoryOptions = params.factoryOptions;
        unsafeAllow = params.unsafeAllow;
        args = params.args;
    }

    const contractFactory = await hre.ethers.getContractFactory(factoryName, factoryOptions);

    let proxy;
    try {
        proxy = await getContract(contractName);
    } catch (e) {
    }

    if (!proxy) {
        console.log(`Proxy ${contractName} not found`)
        proxy = await hre.upgrades.deployProxy(contractFactory, args, {
            kind: 'uups',
            unsafeAllow: unsafeAllow
        });
        console.log(`Deploy ${contractName} Proxy progress -> ` + proxy.address + " tx: " + proxy.deployTransaction.hash);
        await proxy.deployTransaction.wait();
        return;
    } 
    
    let implAddress = await getImplementationAddress(hre.ethers.provider, proxy.address);
    console.log(`Contract ${contractName} found -> proxy [${proxy.address}] impl [${implAddress}]`);
    
    implAddress = await hre.upgrades.deployImplementation(contractFactory, {
        kind: 'uups',
        unsafeAllow: unsafeAllow,
        // unsafeSkipStorageCheck: true,
        // unsafeAllowRenames: true
    });

    console.log(`Deploy new impl -> impl [${implAddress}]`);

    const artifact = await deployments.getExtendedArtifact(factoryName);
    artifact.implementation = implAddress;
    let proxyDeployments = {
        address: proxy.address,
        ...artifact
    }

    await save(contractName, proxyDeployments);

    if (hre.ovn.gov) {
        let timelock = await getContract('AgentTimelock');
        
        // don't know why it is needed
        hre.ethers.provider = new hre.ethers.JsonRpcProvider('http://localhost:8545')
        
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [timelock.address],
        });

        const timelockAccount = await hre.ethers.getSigner(timelock.address);
        await checkTimeLockBalance();
        await proxy.connect(timelockAccount).upgradeTo(implAddress);

        console.log(`[Gov] upgradeTo completed`);
    } else if (!hre.ovn.impl) {
        await proxy.upgradeTo(implAddress);
    }

    return proxyDeployments;
}


module.exports = {
    deployProxy: deployProxy,
    deployProxyMulti: deployProxyMulti,
};
