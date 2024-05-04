require('hardhat-deploy');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");
require('@overnight-contracts/common/utils/hardhat-ovn');
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");

const config = require("@overnight-contracts/common/utils/hardhat-config");

module.exports = {
    namedAccounts: config.namedAccounts,
    networks: config.networks,
    solidity: config.solidity,
    etherscan: config.etherscan,
    gas: 1000000
};
