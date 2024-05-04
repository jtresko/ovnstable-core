const { deployProxy } = require("@overnight-contracts/common/utils/deployProxy");
const {BASE} = require("@overnight-contracts/common/utils/assets");

module.exports = async ({ deployments }) => {
    const { save } = deployments;
    await deployProxy('RoleManager', deployments, save);
};

module.exports.tags = ['RoleManager'];
