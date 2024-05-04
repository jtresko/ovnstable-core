require('hardhat-deploy');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-verify");
require('@overnight-contracts/common/utils/hardhat-ovn');
require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");
require('hardhat-contract-sizer');

const config = require("@overnight-contracts/common/utils/hardhat-config");

module.exports = {
    namedAccounts: config.namedAccounts,
    networks: config.networks,
    solidity: {
        version: "0.8.8",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    etherscan: config.etherscan
};
