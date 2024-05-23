const { deployProxy } = require("@overnight-contracts/common/utils/deployProxy");
const { deploySection, settingSection } = require("@overnight-contracts/common/utils/script-utils");
const { BASE } = require("@overnight-contracts/common/utils/assets");

module.exports = async ({ deployments }) => {
    const { save } = deployments;

    await deploySection(async (name) => {
        await deployProxy(name, deployments, save);
    });

    await settingSection('SynthetixV3', async (strategy) => {
        await (await strategy.setParams(await getParams(), { maxFeePerGas: "10000000", gasLimit: "1000000" })).wait();
    });
};

async function getParams() {
    return {
        usdcToken: BASE.usdc,
        susdcToken: BASE.syntheticUsdc,
        snxToken: BASE.snx,
        aerodromeRouter: BASE.aerodromeRouter,
        wrapperModule: "0x18141523403e2595D31b22604AcB8Fc06a4CaA61",
        synthetixCoreRouter: "0x32c222a9a159782afd7529c87fa34b96ca72c696",
        distributorUsdc: "0xe92bcd40849be5a5eb90065402e508af4b28263b",
        marketId: "1",
        poolId: "1",
        distributorSnx: "0x45063dcd92f56138686810eacb1b510c941d6593",
        poolSnxUsdc: "0xcC79bfA7a3212d94390c358E88afcD39294549ca",
        accountId: 2268367833
    }
}
module.exports.tags = ['StrategySynthetixV3'];
module.exports.strategySynthetixV3Params = getParams;
