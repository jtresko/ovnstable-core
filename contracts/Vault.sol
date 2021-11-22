// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./connectors/aave/interfaces/IAaveIncentivesController.sol";

/**
 * Vault address is used as owner for all tokens for Overnights.
 * So you able to use Vault address to check any tokens balances.
 * Vault doesn't know about what it has and how mauch.
 * Vault can contain any tokens but only IERC20 could be transfered
 * in real work.
 * NOTE: currently work with ETH/MATIC or other payments not realised.
 * NOTE: not used SafeERC20 and it may be changed in future
 */
contract Vault is AccessControl {
    bytes32 public constant PORTFOLIO_MANAGER = keccak256("PORTFOLIO_MANAGER");
    bytes32 public constant REWARD_MANAGER = keccak256("REWARD_MANAGER");

    // Only Vault can claiming aave rewards
    IAaveIncentivesController public aaveReward;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Restricted to admins");
        _;
    }

    modifier onlyPortfolioManager() {
        require(hasRole(PORTFOLIO_MANAGER, msg.sender), "Caller is not the PORTFOLIO_MANAGER");
        _;
    }

    modifier onlyRewardManager() {
        require(hasRole(REWARD_MANAGER, msg.sender), "Caller is not the REWARD_MANAGER");
        _;
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setPortfolioManager(address _portfolioManager) public onlyAdmin {
        require(_portfolioManager != address(0), "Zero address not allowed");
        grantRole(PORTFOLIO_MANAGER, _portfolioManager);
    }

    function setRewardManager(address _rewardManager) public onlyAdmin {
        require(_rewardManager != address(0), "Zero address not allowed");
        grantRole(REWARD_MANAGER, _rewardManager);
    }


    function setAaveReward(address _aaveReward) public onlyAdmin {
        require(_aaveReward != address(0), "Zero address not allowed");
        aaveReward = IAaveIncentivesController(_aaveReward);
    }



    //TODO: do we really need this feature?
    function removePortfolioManager(address _portfolioManager) public onlyAdmin {
        require(_portfolioManager != address(0), "Zero address not allowed");
        revokeRole(PORTFOLIO_MANAGER, _portfolioManager);
    }


    function claimRewardAave(address[] calldata assets, uint256 amount) public onlyRewardManager {
        aaveReward.claimRewards(assets, amount, address(this));
    }


    /**
     * @dev proxy to IERC20().totalSupply();
     */
    function totalSupply(IERC20 token) external view returns (uint256) {
        return token.totalSupply();
    }

    /**
     * @dev proxy to IERC20().balanceOf();
     */
    function balanceOf(IERC20 token, address account) external view returns (uint256) {
        return token.balanceOf(account);
    }

    /**
     * @dev proxy to IERC20().allowance();
     */
    function allowance(
        IERC20 token,
        address owner,
        address spender
    ) external view returns (uint256) {
        return token.allowance(owner, spender);
    }

    /**
     * @dev proxy to IERC20().approve();
     */
    function approve(
        IERC20 token,
        address spender,
        uint256 amount
    ) external onlyPortfolioManager returns (bool) {
        return token.approve(spender, amount);
    }

    /**
     * @dev proxy to IERC20().transfer();
     */
    function transfer(
        IERC20 token,
        address recipient,
        uint256 amount
    ) external onlyPortfolioManager returns (bool) {
        return token.transfer(recipient, amount);
    }

    /**
     * @dev proxy to IERC20().transferFrom();
     */
    function transferFrom(
        IERC20 token,
        address sender,
        address recipient,
        uint256 amount
    ) external onlyPortfolioManager returns (bool) {
        return token.transferFrom(sender, recipient, amount);
    }
}
