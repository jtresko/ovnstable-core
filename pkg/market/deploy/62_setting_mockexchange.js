const hre = require("hardhat");

module.exports = async ({getNamedAccounts, deployments}) => {
    const mockUsdPlusToken = await hre.ethers.getContract("MockUsdPlusToken");
    const mockExchange = await hre.ethers.getContract("MockExchange");
    mockUsdPlusToken.setExchanger(mockExchange.address);

    console.log("MockExchange settings done");
};

module.exports.tags = ['test_setting', 'SettingMockExchange'];
