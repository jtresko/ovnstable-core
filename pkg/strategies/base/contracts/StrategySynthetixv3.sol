// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@overnight-contracts/core/contracts/Strategy.sol";

import "@overnight-contracts/connectors/contracts/stuff/Synthetix.sol";
import "@overnight-contracts/connectors/contracts/stuff/UniswapV3.sol";

import "hardhat/console.sol";

contract StrategySynthetixV3 is Strategy {

    IERC20 public usdcToken;
    IERC20 public susdToken;
    IAccountModule public accountModule;
    IVaultModule public vaultModule;
    IWrapperModule public wrapperModule;
    uint128 public accountId;
    uint128 public marketId;

    ISwapRouter public uniswapV3Router;


    // --- events
    event StrategyUpdatedParams();


    // --- structs

    struct StrategyParams {
        address usdcToken;
        address susdToken;
        address accountModule;
        address vaultModule;
        address wrapperModule;
        address uniswapV3Router;
        uint24 poolFee;
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
        susdToken = IERC20(params.susdToken);
        accountModule = IAccountModule(params.accountModule);
        vaultModule = IVaultModule(params.vaultModule);
        wrapperModule = IWrapperModule(params.wrapperModule);
        uniswapV3Router = ISwapRouter(params.uniswapV3Router);

        accountId = accountModule.createAccount();


        emit StrategyUpdatedParams();
    }


    // --- logic

    function _stake(
        address _asset,
        uint256 _amount
    ) internal override {
        require(_asset == address(usdcToken), "Some token not compatible");

        usdcToken.approve(address(wrapperModule), _amount);

        wrapperModule.wrap(marketId, _amount, );
    }

    function _unstake(
        address _asset,
        uint256 _amount,
        address _beneficiary
    ) internal override returns (uint256) {

        require(_asset == address(usdcToken), "Some token not compatible");

        PikaPerpV3.Stake memory stake = pika.getStake(address(this));

        // 1) amount + 1e2 = pika fix
        // 2) 1e4 = improved accuracy for operations
        // 3) + 1 routing fix
        uint256 shares = ((_amount * 1e6) / stake.amount * uint256(stake.shares)) / 1e4 + 1;
        pika.redeem(address(this), shares, address(this));

        return usdcToken.balanceOf(address(this));
    }

    function _unstakeFull(
        address _asset,
        address _beneficiary
    ) internal override returns (uint256) {

        require(_asset == address(usdcToken), "Some token not compatible");

        uint256 shares = pika.getShare(address(this));
        if (shares == 0) {
            return 0;
        }

        pika.redeem(address(this), shares, address(this));
        return usdcToken.balanceOf(address(this));
    }

    function netAssetValue() external view override returns (uint256) {
        return _total();
    }

    function liquidationValue() external view override returns (uint256) {
        return _total();
    }

    function _total() internal view returns (uint256){
        PikaPerpV3.Stake memory stake = pika.getStake(address(this));
        PikaPerpV3.Vault memory vault = pika.getVault();

        uint256 amount = stake.shares * vault.balance / pika.getTotalShare();
        return uint256(amount) / 1e2;
    }

    function _claimRewards(address _beneficiary) internal override returns (uint256) {

        uint256 shares = pika.getShare(address(this));
        if (shares == 0) {
            return 0;
        }

        uint256 balanceUSDC = usdcToken.balanceOf(address(this));

        // claim OP
        pikaFeeReward.claimReward();

        // claim USDC
        pikaTokenReward.getReward();

        uint256 totalUsdc = usdcToken.balanceOf(address(this)) - balanceUSDC;
        // calc reward USDC value

        uint256 opBalance = opToken.balanceOf(address(this));
        if (opBalance > 0) {

            uint256 opUsdc = UniswapV3Library.singleSwap(
                uniswapV3Router,
                address(opToken),
                address(usdcToken),
                poolFee,
                address(this),
                opBalance,
                0
            );
            totalUsdc += opUsdc;
        }

        if (totalUsdc > 0) {
            usdcToken.transfer(_beneficiary, totalUsdc);
        }

        return totalUsdc;
    }

}
