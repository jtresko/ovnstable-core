// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ISwap {
    // pool data view functions
    function getA() external view returns (uint256);

    function getToken(uint8 index) external view returns (IERC20);

    function getTokenIndex(address tokenAddress) external view returns (uint8);

    function getTokenBalance(uint8 index) external view returns (uint256);

    function getVirtualPrice() external view returns (uint256);

    // min return calculation functions
    function calculateSwap(
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx
    ) external view returns (uint256);

    function calculateTokenAmount(uint256[] calldata amounts, bool deposit)
    external
    view
    returns (uint256);

    function calculateRemoveLiquidity(uint256 amount)
    external
    view
    returns (uint256[] memory);

    function calculateRemoveLiquidityOneToken(
        uint256 tokenAmount,
        uint8 tokenIndex
    ) external view returns (uint256 availableTokenAmount);

    // state modifying functions
    function initialize(
        IERC20[] memory pooledTokens,
        uint8[] memory decimals,
        string memory lpTokenName,
        string memory lpTokenSymbol,
        uint256 a,
        uint256 fee,
        uint256 adminFee,
        address lpTokenTargetAddress
    ) external;

    function swap(
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx,
        uint256 minDy,
        uint256 deadline
    ) external returns (uint256);

    function addLiquidity(
        uint256[] calldata amounts,
        uint256 minToMint,
        uint256 deadline
    ) external returns (uint256);

    function removeLiquidity(
        uint256 amount,
        uint256[] calldata minAmounts,
        uint256 deadline
    ) external returns (uint256[] memory);

    function removeLiquidityOneToken(
        uint256 tokenAmount,
        uint8 tokenIndex,
        uint256 minAmount,
        uint256 deadline
    ) external returns (uint256);

    function removeLiquidityImbalance(
        uint256[] calldata amounts,
        uint256 maxBurnAmount,
        uint256 deadline
    ) external returns (uint256);
}


interface IMiniChefV2 {
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    struct PoolInfo {
        uint128 accSynapsePerShare;
        uint64 lastRewardTime;
        uint64 allocPoint;
    }

    function poolLength() external view returns (uint256);

    function updatePool(uint256 pid) external returns (IMiniChefV2.PoolInfo memory);

    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);

    function deposit(
        uint256 pid,
        uint256 amount,
        address to
    ) external;

    function withdraw(
        uint256 pid,
        uint256 amount,
        address to
    ) external;

    function harvest(uint256 pid, address to) external;

    function withdrawAndHarvest(
        uint256 pid,
        uint256 amount,
        address to
    ) external;

    function emergencyWithdraw(uint256 pid, address to) external;
}


abstract contract SynapseExchange {

    ISwap private synapseSwap;

    function _setSynapseSwap(address _synapseSwap) internal {
        synapseSwap = ISwap(_synapseSwap);
    }

    function _synapseCalculateSwap(
        address tokenFrom,
        address tokenTo,
        uint256 dx
    ) internal view returns (uint256) {
        uint8 tokenIndexFrom = synapseSwap.getTokenIndex(tokenFrom);
        uint8 tokenIndexTo = synapseSwap.getTokenIndex(tokenTo);
        return synapseSwap.calculateSwap(tokenIndexFrom, tokenIndexTo, dx);
    }

    function _synapseSwap(
        address tokenFrom,
        address tokenTo,
        uint256 dx
    ) internal returns (uint256) {
        uint8 tokenIndexFrom = synapseSwap.getTokenIndex(tokenFrom);
        uint8 tokenIndexTo = synapseSwap.getTokenIndex(tokenTo);
        uint256 minDy = synapseSwap.calculateSwap(tokenIndexFrom, tokenIndexTo, dx);
        if (minDy == 0) {
            return 0;
        }
        IERC20(tokenFrom).approve(address(synapseSwap), dx);
        return synapseSwap.swap(tokenIndexFrom, tokenIndexTo, dx, minDy, block.timestamp);
    }

    uint256[49] private __gap;
}
