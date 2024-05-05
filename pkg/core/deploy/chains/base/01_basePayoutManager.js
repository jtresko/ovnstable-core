const hre = require("hardhat");
const {deployProxy} = require("@overnight-contracts/common/utils/deployProxy");
const {Roles} = require("@overnight-contracts/common/utils/roles");
const {getContract, getWalletAddress} = require("@overnight-contracts/common/utils/script-utils");
const {COMMON} = require("@overnight-contracts/common/utils/assets");

module.exports = async ({deployments}) => {
    const {save} = deployments;
    await deployProxy('BasePayoutManager', deployments, save);

    if (hre.ovn && hre.ovn.setting) {

        let roleManager = await hre.ethers.getContract('RoleManager');
        let payoutManager = await hre.ethers.getContract('BasePayoutManager');

        await (await payoutManager.connect.setRoleManager(roleManager.address)).wait();
        await (await payoutManager.setRewardWallet(COMMON.rewardWallet)).wait();
        console.log('setRoleManager done()');

        let exchangeUsdPlus = await getContract('Exchange', 'base');
        let exchangeDaiPlus = await getContract('Exchange', 'base_dai');
        let exchangeUsdcPlus = await getContract('Exchange', 'base_usdc');
        await (await payoutManager.grantRole(Roles.EXCHANGER, exchangeUsdPlus.address)).wait();
        await (await payoutManager.grantRole(Roles.EXCHANGER, exchangeDaiPlus.address)).wait();
        await (await payoutManager.grantRole(Roles.EXCHANGER, exchangeUsdcPlus.address)).wait();
        console.log('EXCHANGER role done()');
    } 

};

module.exports.tags = ['BasePayoutManager'];
