const { BASE } = require("@overnight-contracts/common/utils/assets");
const { getContract } = require("@overnight-contracts/common/utils/script-utils");
const { verify } = require("@overnight-contracts/common/utils/verify-utils");

async function main() {
    let strategy = await getContract('StrategySynthetixV3', 'base')
    console.log((await strategy.liquidationValue()).toString())

    console.log((await strategy.netAssetValue()).toString())

    // let roleManager = await getContract('RoleManager', 'base');
    // await (await strategy.setStrategyParams("0xcd8562CD85fD93C7e2E80B4Cf69097E5562a76f9", roleManager.address)).wait();
    // await (await strategy.stake(BASE.usdc, 1e6)).wait();
    // await (await strategy.claimRewards("0xcd8562CD85fD93C7e2E80B4Cf69097E5562a76f9")).wait()
    // await (await strategy.prepareUnstake((1e6 + 1e8).toFixed(), (0.00937893 * 1e18).toFixed(), { gasPrice: 134700496, gasLimit: 6000000 })).wait()
    // await (await strategy.unstake(BASE.usdc, 1e6 + 1e8, "0xcd8562CD85fD93C7e2E80B4Cf69097E5562a76f9", false)).wait()

    // await (await strategy.setParams({
    //     usdcToken: BASE.usdc,
    //     susdcToken: BASE.syntheticUsdc,
    //     snxToken: BASE.snx,
    //     aerodromeRouter: BASE.aerodromeRouter,
    //     wrapperModule: "0x18141523403e2595D31b22604AcB8Fc06a4CaA61",
    //     synthetixCoreRouter: "0x32c222a9a159782afd7529c87fa34b96ca72c696",
    //     distributorUsdc: "0xe92bcd40849be5a5eb90065402e508af4b28263b",
    //     marketId: "1",
    //     poolId: "1",
    //     distributorSnx: "0x45063dcd92f56138686810eacb1b510c941d6593",
    //     poolSnxUsdc: "0xcC79bfA7a3212d94390c358E88afcD39294549ca"
    // }, { gasPrice: 209278180, gasLimit: 3000000 })).wait();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

