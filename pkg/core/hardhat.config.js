console.log("--run hardhat.config.js");
require('hardhat-deploy');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");
require('hardhat-contract-sizer');
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");
require('@overnight-contracts/common/utils/hardhat-ovn');

const config = require("@overnight-contracts/common/utils/hardhat-config");

module.exports = {
    namedAccounts: config.namedAccounts,
    networks: config.networks,
    solidity: config.solidity,
    zksolc: config.zksolc,
    etherscan: config.etherscan,
};
