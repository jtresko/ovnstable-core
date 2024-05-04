require('hardhat-deploy');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");
require('@overnight-contracts/common/utils/hardhat-ovn');
require('hardhat-contract-sizer');

const config = require("@overnight-contracts/common/utils/hardhat-config");

module.exports = {
    namedAccounts: config.namedAccounts,
    networks: config.networks,
    solidity: config.solidity,
    etherscan: config.etherscan,
};
