const {toAsset, toE18} = require("@overnight-contracts/common/utils/decimals");
const {getContract, showM2M, transferETH, initWallet} = require("@overnight-contracts/common/utils/script-utils");

async function main() {

    let ovn = await getContract('Ovn');

    let wallet = await initWallet();
    await ovn.mint(wallet.address, toE18(1_000_000));
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

