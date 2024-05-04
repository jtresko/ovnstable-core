const hre = require("hardhat");
const { getContract, initWallet } = require("@overnight-contracts/common/utils/script-utils");
const fs = require("fs");
const AGENT_TIMELOCK_ABI = require("@overnight-contracts/governance/scripts/abi/AGENT_TIMELOCK_ABI.json");
const PREDECESSOR = "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
    let timelock = await getContract("AgentTimelock");

    let network = process.env.stand;
    
    let name = "05_migrate_usdplus";
    let batch = JSON.parse(
        await fs.readFileSync(`./batches/${network}/${name}.json`),
    );

    let addresses = [];
    let values = [];
    let datas = [];
    let salt = [];

    for (let transaction of batch.transactions) {
        addresses.push(transaction.contractInputsValues.target);
        values.push(Number.parseInt(transaction.contractInputsValues.value));
        datas.push(transaction.contractInputsValues.data);
        salt.push(transaction.contractInputsValues.salt);
        console.log(transaction);
    }

    timelock = await hre.ethers.getContractAt(
        AGENT_TIMELOCK_ABI,
        timelock.address,
        await initWallet(),
    );

    for (let i = 0; i < addresses.length; i++) {
        let hash = await timelock.hashOperation(
            addresses[i],
            values[i],
            datas[i],
            PREDECESSOR,
            salt[i],
        );
        console.log("HashOperation: " + hash);

        let timestamp = await timelock.getTimestamp(hash);
        console.log(`Timestamp: ${timestamp}`);
        if (timestamp == 0) {
            console.error("Proposal not exists");
        }
        if (timestamp == 1) {
            console.error("Proposal already executed");
        }

        if (timestamp > 1) {
            await (await timelock.execute(addresses[i], values[i], datas[i], PREDECESSOR, salt[i])).wait();
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
