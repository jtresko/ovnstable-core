// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.9.0;

interface IMotivationalFund {

    function exchange() external view returns (address);

    function mint(address _sender, uint256 _amount) external;

    function burn(address _sender, uint256 _amount) external;

    /**
     * @dev See {IERC20-transfer}.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev See {IERC20-approve}.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Calculates the balance of the user: principal balance + interest generated by the principal
     * @param user The user whose balance is calculated
     * @return The balance of the user
     **/
    function balanceOf(address user) external view returns (uint256);

    /**
     * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
     * updated stored balance divided by the reserve's liquidity index at the moment of the update
     * @param user The user whose balance is calculated
     * @return The scaled balance of the user
     **/
    function scaledBalanceOf(address user) external view returns (uint256);

    /**
     * @dev calculates the total supply of the specific aToken
     * since the balance of every single user increases over time, the total supply
     * does that too.
     * @return the current total supply
     **/
    function totalSupply() external view returns (uint256);

    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) external returns (bool);

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool);

    /**
     * @dev Returns the scaled total supply of the variable debt token
     * @return the scaled total supply
     **/
    function scaledTotalSupply() external view returns (uint256);

    function ownerLength() external view returns (uint256);

    function nonRebaseOwnersLength() external view returns (uint256);

    function ownerAt(uint256 index) external view returns (address);

    function ownerBalanceAt(uint256 index) external view returns (uint256);

    /**
   * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() external view returns (string memory);

    /**
   * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5.05` (`505 / 10 ** 2`).
     *
     * Tokens usually opt for a value of 18, imitating the relationship between
     * Ether and Wei. This is the value {ERC20} uses, unless this function is
     * overridden;
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() external pure returns (uint8);

    function changeNegativeSupply(uint256 _newTotalSupply) external;

    function changeSupply(uint256 _newTotalSupply, uint256 _totalDeposit) external;

    function rebasingCreditsPerToken() external view returns (uint256);

    function isPaused() external view returns (bool);

    function totalShares() external view returns (uint256);

    function sharesBalanceOf(address _account) external view returns (uint256);
}
