const { deployProxy } = require("@overnight-contracts/common/utils/deployProxy");
const { ARBITRUM } = require("@overnight-contracts/common/utils/assets");
const hre = require("hardhat");

module.exports = async ({ deployments }) => {
    const { save } = deployments;

    await deployProxy('ConvexZap', deployments, save);
    console.log("ConvexZap deploy done()");

    let params = {
        odosRouter: ARBITRUM.odosRouterV2,
    }

    let zap = await hre.ethers.getContract('ConvexZap');
    await (await zap.setParams(params)).wait();
    console.log('ConvexZap setParams done()');
};

module.exports.tags = ['ConvexZap'];
