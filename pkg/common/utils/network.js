const dotenv = require('dotenv');
dotenv.config({path:__dirname+ '/../../../.env'});


function node_url() {

    if (process.env.network === "localhost") {
        return 'http://localhost:8545';
    }

    return process.env['ETH_NODE_URI_' + process.env.stand.toUpperCase()];
}

function accounts() {
    const pk = process.env.PK;

    if (!pk || pk === '') {
        throw Error("Need to specify PK");
    }
    return [pk];
}

function isZkSync() {
    return process.env.stand === "zksync";
}

function blockNumber() {
    return Number.parseInt(process.env.block);
}

module.exports = {
    node_url: node_url,
    isZkSync: isZkSync,
    accounts: accounts,
    blockNumber: blockNumber
}
