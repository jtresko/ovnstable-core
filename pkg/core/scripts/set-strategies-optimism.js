const {getContract} = require("@overnight-contracts/common/utils/script-utils");
const {createProposal} = require("@overnight-contracts/common/utils/governance");

async function main() {

    let weights = [
        {
            "strategy": "0x1a8bf92aBe1De4bDbf5fB8AF223ec5feDcefFB76",
            "name": "Aave",
            "minWeight": 0,
            "targetWeight": 2.5,
            "maxWeight": 5,
            "enabled": true,
            "enabledReward": true
        },

        {
            "strategy": "0xF7d693CE960e70721F0353F967360046Ba7d4eFA",
            "name": "Synapse USDC",
            "minWeight": 0,
            "targetWeight": 97.5,
            "maxWeight": 100,
            "enabled": true,
            "enabledReward": true
        },
    ]

    let totalWeight = 0;
    for (const weight of weights) {
        totalWeight += weight.targetWeight * 1000;
    }
    console.log(`totalWeight: ${totalWeight}`)

    if (totalWeight !== 100000) {
        console.log(`Total weight not 100000`)
        return
    }

    weights = weights.map(value => {
        delete value.name
        value.targetWeight = value.targetWeight * 1000;
        value.maxWeight = value.maxWeight * 1000;

        return value;
    })

    // await changeWeightsAndBalance(weights);
    // await proposal(weights);
    await setWeights(weights);
}

async function proposal(weights) {
    let pm = await getContract('PortfolioManager');

    let addresses = [];
    let values = [];
    let abis = [];

    addresses.push(pm.address);
    values.push(0);
    abis.push(pm.interface.encodeFunctionData('setStrategyWeights', [weights]));

    addresses.push(pm.address);
    values.push(0);
    abis.push(pm.interface.encodeFunctionData('balance', []));

    await createProposal(addresses, values, abis);
}

async function setWeights(weights) {
    let pm = await getContract('PortfolioManager', 'optimism');

    await (await pm.setStrategyWeights(weights)).wait();
    await (await pm.balance()).wait();
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
