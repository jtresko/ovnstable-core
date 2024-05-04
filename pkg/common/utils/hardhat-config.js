const dotenv = require('dotenv');
console.log('Process:' + process.cwd());
dotenv.config({path:__dirname+ '/../../../.env'});
const {node_url, accounts, isZkSync, blockNumber} = require("./network");

function getParam(key, defaultValue="") {
    const args = process.argv;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--" + key) {
            return args[i + 1];
        }
    }
    
    return defaultValue;
}

if (!process.env.network) {
    process.env.network = getParam("network", "hardhat");
    process.env.stand = getParam("stand", "base");
    process.env.token = getParam("token");
    process.env.block = getParam("block", "1");
    process.env.standtoken = process.env.stand + (process.env.token === "" ? "" : "_" + process.env.token);
}
console.log("process.env.network", process.env.network);
console.log("process.env.stand", process.env.stand);
console.log("process.env.token", process.env.token);
console.log("process.env.block", process.env.block);
console.log("process.env.standtoken", process.env.standtoken);


class Chain {
    static get ARBITRUM() { return 'ARBITRUM'; }
    static get BASE() { return 'BASE'; }
    static get POLYGON() { return 'POLYGON'; }
    static get OPTIMISM() { return 'OPTIMISM'; }
    static get BSC() { return 'BSC'; }
    static get ZKSYNC() { return 'ZKSYNC'; }
    static get LINEA() { return 'LINEA'; }
    static get BLAST() { return 'BLAST'; }

    static get list() {
        return ['ARBITRUM', 'BASE', 'POLYGON', 'OPTIMISM', 'BSC', 'ZKSYNC', 'LINEA', 'BLAST']
    }
}

function getNetworks() {

    return {

        main: {
            url: node_url(),
            accounts: accounts(),
            zksync: isZkSync(),
            timeout: 10000000
        },

        hardhat: {
            zksync: isZkSync(),
            forking: {
                url: node_url(),
                blockNumber: blockNumber(),
                ignoreUnknownTxType: true,
            },
            accounts: {
                accountsBalance: "100000000000000000000000000"
            }
        },

        localhost: {
            url: node_url(),
            accounts: accounts(),
            zksync: isZkSync(),
            timeout: 10000000
        }
    }
}

let namedAccounts = {
    deployer: {
        default: 0,
        polygon: '0x66B439c0a695cc3Ed3d9f50aA4E6D2D917659FfD',
        ganache: "0xa0df350d2637096571F7A701CBc1C5fdE30dF76A"
    },

    recipient: {
        default: 1,
    },

    anotherAccount: {
        default: 2
    }
}

let zksolc = {
    version: "1.3.13",
    compilerSource: "binary",
    settings: {
        // contractsToCompile: ['Exchange']
    },
}

let solidity = {
    version: "0.8.17",
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
}

const {ARBITRUM, BASE, POLYGON, OPTIMISM, BLAST} = require("./assets");
const {Wallets} = require("./wallets");

function getEtherScan() {

    let object = {

        customChains: [
            {
                network: "base",
                chainId:  8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org"
                }
            },
            {
                network: "base_dai",
                chainId:  8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org"
                }
            },
            {
                network: "linea",
                chainId:  59144,
                urls: {
                    apiURL: "https://api.lineascan.build/api",
                    browserURL: "https://lineascan.build"
                }
            },
            {
                network: "linea_usdt",
                chainId:  59144,
                urls: {
                    apiURL: "https://api.lineascan.build/api",
                    browserURL: "https://lineascan.build"
                }
            },
            {
                network: "arbitrum_dai",
                chainId:  42161,
                urls: {
                    apiURL: "https://api.arbiscan.io/api",
                    browserURL: "https://arbiscan.io"
                }
            },
            {
                network: "blast",
                chainId:  81457,
                urls: {
                    apiURL: "https://api.blastscan.io/api",
                    browserURL: "https://blastscan.io/"
                }
            },
            {
                network: "blast_usdc",
                chainId:  81457,
                urls: {
                    apiURL: "https://api.blastscan.io/api",
                    browserURL: "https://blastscan.io/"
                }
            }
        ]

    };


    // Run command to show support native chains: npx hardhat verify --list-networks
    // if plugin not support chain then add chain to customChains section
    object.apiKey = {
        base: process.env[`ETHERSCAN_API_BASE`],
        base_dai: process.env[`ETHERSCAN_API_BASE`],
        linea: process.env[`ETHERSCAN_API_LINEA`],
        linea_usdt: process.env[`ETHERSCAN_API_LINEA`],
        optimisticEthereum: process.env[`ETHERSCAN_API_OPTIMISM`],
        polygon: process.env[`ETHERSCAN_API_POLYGON`],
        bsc: process.env[`ETHERSCAN_API_BSC`],
        arbitrumOne: process.env[`ETHERSCAN_API_ARBITRUM`],
        arbitrum_dai: process.env[`ETHERSCAN_API_ARBITRUM`],
        blast: process.env[`ETHERSCAN_API_BLAST`],
        blast_usdc: process.env[`ETHERSCAN_API_BLAST`],
    }

    return object;
}

module.exports = {
    Chain: Chain,
    networks: getNetworks(),
    namedAccounts: namedAccounts,
    solidity: solidity,
    zksolc: zksolc,
    etherscan: getEtherScan()
};
