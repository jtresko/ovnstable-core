require('hardhat-deploy');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");
require('@overnight-contracts/common/utils/hardhat-ovn');
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");

const config = require("@overnight-contracts/common/utils/hardhat-config");

module.exports = {
    namedAccounts: config.namedAccounts,
    networks: config.networks,
    solidity: config.solidity,
    zksolc: config.zksolc,
    etherscan: config.etherscan
};
