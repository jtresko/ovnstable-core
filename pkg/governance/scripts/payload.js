const {toAsset, toE18} = require("@overnight-contracts/common/utils/decimals");
const {getContract, showM2M, transferETH, initWallet} = require("@overnight-contracts/common/utils/script-utils");

async function main() {

    let timelock = await getContract('AgentTimelock')
    const payload = timelock.interface.encodeFunctionData('updateDelay', [10]);
    console.log(payload);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

