// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@overnight-contracts/core/contracts/Strategy.sol";

import "@overnight-contracts/connectors/contracts/stuff/Synthetix.sol";
import {AerodromeLibrary} from "@overnight-contracts/connectors/contracts/stuff/Aerodrome.sol";

import "hardhat/console.sol";

contract StrategySynthetixV3 is Strategy {

    IERC20 public usdcToken;
    IERC20 public susdcToken;
    IERC20 public snxToken;
    IWrapperModule public wrapperModule;
    ICoreProxy public synthetixCoreRouter;
    uint128 public accountId;
    uint128 public marketId;
    uint128 public poolId;
    address public distributorUsdc;
    address public distributorSnx;
    address public poolSnxUsdc;
    address public aerodromeRouter;
    uint256 susdcDecimals;
    uint256 usdcDecimals;


    // --- events
    event StrategyUpdatedParams();


    // --- structs

    struct StrategyParams {
        address usdcToken;
        address susdcToken;
        address snxToken;
        address wrapperModule;
        address synthetixCoreRouter;
        address aerodromeRouter;
        address distributorUsdc;
        uint128 marketId;
        uint128 poolId;
        address distributorSnx;
        address poolSnxUsdc;
        uint128 accountId;
    }


    // ---  constructor

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() initializer public {
        __Strategy_init();
    }


    // --- Setters

    function setParams(StrategyParams calldata params) external onlyAdmin {
        usdcToken = IERC20(params.usdcToken);
        susdcToken = IERC20(params.susdcToken);
        snxToken = IERC20(params.snxToken);
        wrapperModule = IWrapperModule(params.wrapperModule);
        synthetixCoreRouter = ICoreProxy(params.synthetixCoreRouter);
        aerodromeRouter = params.aerodromeRouter;
        poolSnxUsdc = params.poolSnxUsdc;
        marketId = params.marketId;
        poolId = params.poolId;
        distributorSnx = params.distributorSnx;
        distributorUsdc = params.distributorUsdc;
        
        usdcDecimals = 10 ** IERC20Metadata(params.usdcToken).decimals();
        susdcDecimals = 10 ** IERC20Metadata(params.susdcToken).decimals();
        console.log("usdcBalance", usdcToken.balanceOf(address(this)));
        
        usdcToken.approve(address(wrapperModule), 1000000);
        console.log("usdcBalance", usdcToken.balanceOf(address(this)));

        uint256 susdcAmountMin = _convertUsdcToSusdc(1000000);
        console.log("susdcAmountMin", susdcAmountMin);

        wrapperModule.wrap(marketId, 1000000, susdcAmountMin);

        synthetixCoreRouter.createAccount(params.accountId);

        accountId = params.accountId;

        emit StrategyUpdatedParams();
    }


    // --- logic

    function _stake(
        address _asset,
        uint256 _amount
    ) internal override {
        require(_asset == address(usdcToken), "Some token not compatible");
        console.log("_stake");

        usdcToken.approve(address(wrapperModule), _amount);

        uint256 susdcAmountMin = _convertUsdcToSusdc(_amount);

        console.log("usdcBalance", _amount);
        console.log("susdcAmountMin", susdcAmountMin);

        wrapperModule.wrap(marketId, _amount, susdcAmountMin);
        
        uint256 susdcBalance = susdcToken.balanceOf(address(this));

        susdcToken.approve(address(synthetixCoreRouter), susdcBalance);

        console.log("susdcBalance", susdcBalance);

        synthetixCoreRouter.deposit(accountId, address(susdcToken), susdcBalance);
        
        uint256 collateralAmount = synthetixCoreRouter.getPositionCollateral(
            accountId,
            poolId,
            address(susdcToken));
        console.log("collateralAmount", collateralAmount);

        synthetixCoreRouter.delegateCollateral(
            accountId,
            poolId,
            address(susdcToken),
            susdcBalance + collateralAmount,
            1e18);
        console.log("end _stake");
    }

    function prepareUnstake(uint256 amount) external onlyAdmin {
        uint256 susdcAmount = _convertUsdcToSusdc(amount);
        console.log("amount", amount);
        console.log("susdcAmount", susdcAmount);
        uint256 collateralAmount = synthetixCoreRouter.getPositionCollateral(
            accountId,
            poolId,
            address(susdcToken));
        console.log("collateralAmount", collateralAmount);

        require(collateralAmount >= susdcAmount, "collateral is lower than prepare withdraw amount");

        synthetixCoreRouter.delegateCollateral(
            accountId,
            poolId,
            address(susdcToken),
            collateralAmount - susdcAmount,
            1e18);
        console.log("end _unstake");
    }

    function _unstake(
        address _asset,
        uint256 _amount,
        address _beneficiary
    ) internal override returns (uint256) {
        console.log("_unstake");

        require(_asset == address(usdcToken), "Some token not compatible");

        uint256 susdcToWithdraw = _convertUsdcToSusdc(_amount);
        console.log("_amount", _amount);
        console.log("susdcToWithdraw", susdcToWithdraw);

        synthetixCoreRouter.withdraw(accountId, address(susdcToken), susdcToWithdraw);
        uint256 susdcBalance = susdcToken.balanceOf(address(this));
        console.log("susdcBalance", susdcBalance);
        uint256 usdcAmountMint = _convertSusdcToUsdc(susdcBalance);
        console.log("usdcAmountMint", usdcAmountMint);
        susdcToken.approve(address(wrapperModule), susdcBalance);

        wrapperModule.unwrap(marketId, susdcBalance, usdcAmountMint);
        console.log("usdcToken.balanceOf(address(this))", usdcToken.balanceOf(address(this)));
        console.log("end _unstake");
        

        return usdcToken.balanceOf(address(this));
    }

    function _unstakeFull(
        address _asset,
        address _beneficiary
    ) internal override returns (uint256) {

        return usdcToken.balanceOf(address(this));
    }

    function netAssetValue() external view override returns (uint256) {
        return _total();
    }

    function liquidationValue() external view override returns (uint256) {
        return _total();
    }

    function _total() internal view returns (uint256){
        console.log("total");
        uint256 collateralAmount = synthetixCoreRouter.getPositionCollateral(
            accountId,
            poolId,
            address(susdcToken));
        console.log("collateralAmount", collateralAmount);
        uint256 freeCollateral = synthetixCoreRouter.getAccountAvailableCollateral(accountId, address(susdcToken));
        console.log("freeCollateral", freeCollateral);
        return _convertSusdcToUsdc(collateralAmount + freeCollateral);


    }

    function _claimRewards(address _beneficiary) internal override returns (uint256) {

        synthetixCoreRouter.claimRewards(accountId, poolId, address(susdcToken), distributorSnx);
        synthetixCoreRouter.claimRewards(accountId, poolId, address(susdcToken), distributorUsdc);

        uint256 snxBalance = snxToken.balanceOf(address(this));
        if (snxBalance > 0) {
            uint256 usdcBalance = AerodromeLibrary.getAmountsOut(
                aerodromeRouter,
                address(snxToken),
                address(usdcToken),
                poolSnxUsdc,
                snxBalance
            );
            if (usdcBalance > 0) {
                usdcBalance = AerodromeLibrary.singleSwap(
                    aerodromeRouter,
                    address(snxToken),
                    address(usdcToken),
                    poolSnxUsdc,
                    snxBalance,
                    usdcBalance * 99 / 100,
                    address(this)
                );
            }
        }

        
        uint256 totalUsdc = usdcToken.balanceOf(address(this));


        if (totalUsdc > 0) {
            usdcToken.transfer(_beneficiary, totalUsdc);
        }

        return totalUsdc;
    }

    function _convertUsdcToSusdc(uint256 amount) internal view returns (uint256) {
        return amount * (susdcDecimals) / ( usdcDecimals);
    }

    function _convertSusdcToUsdc(uint256 amount) internal view returns (uint256) {
        return amount * (usdcDecimals) / ( susdcDecimals);
    }

}
