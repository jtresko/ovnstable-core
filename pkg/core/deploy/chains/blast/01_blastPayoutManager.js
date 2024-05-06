const hre = require("hardhat");
const {deployProxy} = require("@overnight-contracts/common/utils/deployProxy");
const {Roles} = require("@overnight-contracts/common/utils/roles");
const {getContract} = require("@overnight-contracts/common/utils/script-utils");
const {COMMON} = require("@overnight-contracts/common/utils/assets");

module.exports = async ({deployments}) => {
    const {save} = deployments;
    await deployProxy('BlastPayoutManager', deployments, save);

    if (hre.ovn.setting) {

        let roleManager = await hre.ethers.getContract('RoleManager');
        let payoutManager = await hre.ethers.getContract('BlastPayoutManager');

        console.log("role", roleManager.address);
        await (await payoutManager.setRoleManager(roleManager.address)).wait();
        await (await payoutManager.setRewardWallet(COMMON.rewardWallet)).wait();
        console.log('setRoleManager done()');

        let exchangeUsdPlus = await getContract('Exchange', 'blast');
        let exchangeUsdcPlus = await getContract('Exchange', 'blast_usdc');
        await (await payoutManager.grantRole(Roles.EXCHANGER, exchangeUsdPlus.address)).wait();
        await (await payoutManager.grantRole(Roles.EXCHANGER, exchangeUsdcPlus.address)).wait();
        console.log('EXCHANGER role done()');
    }

};

module.exports.tags = ['BlastPayoutManager'];
