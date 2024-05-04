const hre = require("hardhat");

let {POLYGON} = require('@overnight-contracts/common/utils/assets');

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const market = await hre.ethers.getContract("Market");
    const mockExchange = await hre.ethers.getContract("MockExchange");
    const mockUsdPlusToken = await hre.ethers.getContract("MockUsdPlusToken");
    const wrappedUsdPlusToken = await hre.ethers.getContract("WrappedUsdPlusToken");

    await (await market.setTokens(POLYGON.usdc, mockUsdPlusToken.address, wrappedUsdPlusToken.address)).wait();
    await (await market.setParams(mockExchange.address)).wait();

    console.log("MockMarket settings done");
};

module.exports.tags = ['test_setting', 'SettingMockMarket'];
