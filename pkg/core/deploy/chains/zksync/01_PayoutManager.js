const hre = require("hardhat");
const {deployProxy} = require("@overnight-contracts/common/utils/deployProxy");
const {Roles} = require("@overnight-contracts/common/utils/roles");
const {getContract, getWalletAddress, transferETH, initWallet} = require("@overnight-contracts/common/utils/script-utils");
const {COMMON} = require("@overnight-contracts/common/utils/assets");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");

module.exports = async ({deployments}) => {
    const {save} = deployments;

    if (process.env.network === "localhost") {
        await transferETH(1, await getWalletAddress());
    }

    await deployProxy('ZkSyncPayoutManager', deployments, save);
  
    
    if (hre.ovn && hre.ovn.setting){

        let roleManager = await hre.ethers.getContract('RoleManager');
        let payoutManager = await hre.ethers.getContract('ZkSyncPayoutManager');

        await (await payoutManager.setRoleManager(roleManager.address)).wait();
        await (await payoutManager.setRewardWallet(COMMON.rewardWallet)).wait();
        console.log('setRoleManager done()');

        let exchangeUsdPlus = await getContract('Exchange', 'zksync');
        let exchangeUsdtPlus = await getContract('Exchange', 'zksync_usdt');
        await (await payoutManager.grantRole(Roles.EXCHANGER, exchangeUsdPlus.address)).wait();
        await (await payoutManager.grantRole(Roles.EXCHANGER, exchangeUsdtPlus.address)).wait();
        console.log('EXCHANGER role done()');
    } 

};

module.exports.tags = ['ZkSyncPayoutManager'];
