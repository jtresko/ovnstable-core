// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@overnight-contracts/core/contracts/Strategy.sol";

import "@overnight-contracts/connectors/contracts/stuff/Synthetix.sol";
import {AerodromeLibrary} from "@overnight-contracts/connectors/contracts/stuff/Aerodrome.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "hardhat/console.sol";

contract StrategySynthetixV3 is Strategy,IERC721Receiver {

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

        accountId = 170141183460469231731687303715884106674;//synthetixCoreRouter.createAccount();
        

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

    function prepareClaimUsd() external onlyAdmin {
        int256 currentDebt = synthetixCoreRouter.getPositionDebt(
            accountId,
            poolId,
            address(susdcToken));

        if(currentDebt < 0) {        
            synthetixCoreRouter.mintUsd(
                accountId,
                poolId,
                address(susdcToken),
                uint256(-currentDebt)
            );
        }

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

        int256 currentDebt = synthetixCoreRouter.getPositionDebt(
            accountId,
            poolId,
            address(susdcToken));

        console.log("currentDebt", uint256(currentDebt));

        if(currentDebt > 0) {
            uint256 debtInUsdc = _convertSusdcToUsdc(uint256(currentDebt)) + 10;
            require(debtInUsdc <= usdcToken.balanceOf(address(this)), "not enough usdc to pay for debt");     
            usdcToken.approve(address(wrapperModule), debtInUsdc);

            uint256 susdcAmountMin = _convertUsdcToSusdc(debtInUsdc);
            console.log("susdcAmountMin", susdcAmountMin);

            wrapperModule.wrap(marketId, debtInUsdc, susdcAmountMin);
            
            uint256 susdcBalance = susdcToken.balanceOf(address(this));

            susdcToken.approve(address(synthetixCoreRouter), susdcBalance);

            console.log("susdcBalance", susdcBalance);
            
            console.log("burnUsd", uint256(currentDebt));      
            synthetixCoreRouter.burnUsd(
                accountId,
                poolId,
                address(susdcToken),
                uint256(currentDebt)
            );

        }

        uint256 leverage;
        if(collateralAmount == susdcAmount){
            leverage = 0;
        } else {
            leverage = 1e18;
        }
        console.log("leverage", leverage);
        synthetixCoreRouter.delegateCollateral(
            accountId,
            poolId,
            address(susdcToken),
            collateralAmount - susdcAmount,
            leverage);
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
        uint256 susdcBalance = susdcToken.balanceOf(address(this));
        uint256 usdcBalance = usdcToken.balanceOf(address(this));


        return _convertSusdcToUsdc(collateralAmount + freeCollateral + susdcBalance) + usdcBalance;
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

        /// @notice Used for ERC721 safeTransferFrom
    function onERC721Received(address, address, uint256, bytes memory)
    public
    virtual
    override
    returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

}
