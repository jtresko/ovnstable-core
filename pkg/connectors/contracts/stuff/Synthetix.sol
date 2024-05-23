// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library OrderFees {

    struct Data {
        uint256 fixedFees;
        uint256 utilizationFees;
        int256 skewFees;
        int256 wrapperFees;
    }
}

interface ICoreProxy {
    function deposit(
        uint128 accountId,
        address collateralType,
        uint256 tokenAmount
    ) external;

    function withdraw(
        uint128 accountId,
        address collateralType,
        uint256 tokenAmount
    ) external;

    function claimRewards(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        address distributor
    ) external returns(uint256);

    function getAccountAvailableCollateral(
        uint128 accountId,
        address collateralType
    ) external view returns(uint256);

    /**
     * @notice Updates an account's delegated collateral amount for the specified pool and collateral type pair.
     * @param accountId The id of the account associated with the position that will be updated.
     * @param poolId The id of the pool associated with the position.
     * @param collateralType The address of the collateral used in the position.
     * @param newCollateralAmountD18 The new amount of collateral delegated in the position, denominated with 18 decimals of precision.
     * @param leverage The new leverage amount used in the position, denominated with 18 decimals of precision.
     *
     * Requirements:
     *
     * - `ERC2771Context._msgSender()` must be the owner of the account, have the `ADMIN` permission, or have the `DELEGATE` permission.
     * - If increasing the amount delegated, it must not exceed the available collateral (`getAccountAvailableCollateral`) associated with the account.
     * - If decreasing the amount delegated, the liquidity position must have a collateralization ratio greater than the target collateralization ratio for the corresponding collateral type.
     *
     * Emits a {DelegationUpdated} event.
     */
    function delegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 newCollateralAmountD18,
        uint256 leverage
    ) external;

    /**
     * @notice Returns the collateralization ratio of the specified liquidity position. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     * @param accountId The id of the account whose collateralization ratio is being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return ratioD18 The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.
     */
    function getPositionCollateralRatio(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (uint256 ratioD18);

    /**
     * @notice Returns the debt of the specified liquidity position. Credit is expressed as negative debt.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @param accountId The id of the account being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return debtD18 The amount of debt held by the position, denominated with 18 decimals of precision.
     */
    function getPositionDebt(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (int256 debtD18);

    /**
     * @notice Returns the amount of the collateral associated with the specified liquidity position.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @param accountId The id of the account being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return amount The amount of collateral used in the position, denominated with 18 decimals of precision.
     */
    function getPositionCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view returns (uint256 amount);

    /**
     * @notice Returns all information pertaining to a specified liquidity position in the vault module.
     * @param accountId The id of the account being queried.
     * @param poolId The id of the pool in which the account's position is held.
     * @param collateralType The address of the collateral used in the queried position.
     * @return collateralAmountD18 The amount of collateral used in the position, denominated with 18 decimals of precision.
     * @return collateralValueD18 The value of the collateral used in the position, denominated with 18 decimals of precision.
     * @return debtD18 The amount of debt held in the position, denominated with 18 decimals of precision.
     * @return collateralizationRatioD18 The collateralization ratio of the position (collateral / debt), denominated with 18 decimals of precision.
     **/
    function getPosition(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    )
        external
        returns (
            uint256 collateralAmountD18,
            uint256 collateralValueD18,
            int256 debtD18,
            uint256 collateralizationRatioD18
        );

    /**
     * @notice Returns the total debt (or credit) that the vault is responsible for. Credit is expressed as negative debt.
     * @dev This is not a view function, and actually updates the entire debt distribution chain.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @param poolId The id of the pool that owns the vault whose debt is being queried.
     * @param collateralType The address of the collateral of the associated vault.
     * @return debtD18 The overall debt of the vault, denominated with 18 decimals of precision.
     **/
    function getVaultDebt(uint128 poolId, address collateralType) external returns (int256 debtD18);

    /**
     * @notice Returns the amount and value of the collateral held by the vault.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev collateralAmount is represented as an integer with 18 decimals.
     * @dev collateralValue is represented as an integer with the number of decimals specified by the collateralType.
     * @param poolId The id of the pool that owns the vault whose collateral is being queried.
     * @param collateralType The address of the collateral of the associated vault.
     * @return collateralAmountD18 The collateral amount of the vault, denominated with 18 decimals of precision.
     * @return collateralValueD18 The collateral value of the vault, denominated with 18 decimals of precision.
     */
    function getVaultCollateral(
        uint128 poolId,
        address collateralType
    ) external view returns (uint256 collateralAmountD18, uint256 collateralValueD18);

    /**
     * @notice Returns the collateralization ratio of the vault. If debt is negative, this function will return 0.
     * @dev Call this function using `callStatic` to treat it as a view function.
     * @dev The return value is a percentage with 18 decimals places.
     * @param poolId The id of the pool that owns the vault whose collateralization ratio is being queried.
     * @param collateralType The address of the collateral of the associated vault.
     * @return ratioD18 The collateralization ratio of the vault, denominated with 18 decimals of precision.
     */
    function getVaultCollateralRatio(
        uint128 poolId,
        address collateralType
    ) external returns (uint256 ratioD18);

    /**
     * @notice Mints an account token with id `requestedAccountId` to `ERC2771Context._msgSender()`.
     * @param requestedAccountId The id requested for the account being created. Reverts if id already exists.
     *
     * Requirements:
     *
     * - `requestedAccountId` must not already be minted.
     * - `requestedAccountId` must be less than type(uint128).max / 2
     *
     * Emits a {AccountCreated} event.
     */
    function createAccount(uint128 requestedAccountId) external;

    /**
     * @notice Mints an account token with an available id to `ERC2771Context._msgSender()`.
     *
     * Emits a {AccountCreated} event.
     */
    function createAccount() external returns (uint128 accountId);

    /**
     * @notice Called by AccountTokenModule to notify the system when the account token is transferred.
     * @dev Resets user permissions and assigns ownership of the account token to the new holder.
     * @param to The new holder of the account NFT.
     * @param accountId The id of the account that was just transferred.
     *
     * Requirements:
     *
     * - `ERC2771Context._msgSender()` must be the account token.
     */
    function notifyAccountTransfer(address to, uint128 accountId) external;

    /**
     * @notice Grants `permission` to `user` for account `accountId`.
     * @param accountId The id of the account that granted the permission.
     * @param permission The bytes32 identifier of the permission.
     * @param user The target address that received the permission.
     *
     * Requirements:
     *
     * - `ERC2771Context._msgSender()` must own the account token with ID `accountId` or have the "admin" permission.
     *
     * Emits a {PermissionGranted} event.
     */
    function grantPermission(uint128 accountId, bytes32 permission, address user) external;

    /**
     * @notice Revokes `permission` from `user` for account `accountId`.
     * @param accountId The id of the account that revoked the permission.
     * @param permission The bytes32 identifier of the permission.
     * @param user The target address that no longer has the permission.
     *
     * Requirements:
     *
     * - `ERC2771Context._msgSender()` must own the account token with ID `accountId` or have the "admin" permission.
     *
     * Emits a {PermissionRevoked} event.
     */
    function revokePermission(uint128 accountId, bytes32 permission, address user) external;

    /**
     * @notice Revokes `permission` from `ERC2771Context._msgSender()` for account `accountId`.
     * @param accountId The id of the account whose permission was renounced.
     * @param permission The bytes32 identifier of the permission.
     *
     * Emits a {PermissionRevoked} event.
     */
    function renouncePermission(uint128 accountId, bytes32 permission) external;

    /**
     * @notice Returns `true` if `user` has been granted `permission` for account `accountId`.
     * @param accountId The id of the account whose permission is being queried.
     * @param permission The bytes32 identifier of the permission.
     * @param user The target address whose permission is being queried.
     * @return hasPermission A boolean with the response of the query.
     */
    function hasPermission(
        uint128 accountId,
        bytes32 permission,
        address user
    ) external view returns (bool hasPermission);

    /**
     * @notice Returns `true` if `target` is authorized to `permission` for account `accountId`.
     * @param accountId The id of the account whose permission is being queried.
     * @param permission The bytes32 identifier of the permission.
     * @param target The target address whose permission is being queried.
     * @return isAuthorized A boolean with the response of the query.
     */
    function isAuthorized(
        uint128 accountId,
        bytes32 permission,
        address target
    ) external view returns (bool isAuthorized);

    /**
     * @notice Returns the address for the account token used by the module.
     * @return accountNftToken The address of the account token.
     */
    function getAccountTokenAddress() external view returns (address accountNftToken);

    /**
     * @notice Returns the address that owns a given account, as recorded by the system.
     * @param accountId The account id whose owner is being retrieved.
     * @return owner The owner of the given account id.
     */
    function getAccountOwner(uint128 accountId) external view returns (address owner);

    /**
     * @notice Returns the last unix timestamp that a permissioned action was taken with this account
     * @param accountId The account id to check
     * @return timestamp The unix timestamp of the last time a permissioned action occured with the account
     */
    function getAccountLastInteraction(uint128 accountId) external view returns (uint256 timestamp);
}


interface IWrapperModule {

    function unwrap(
        uint128 marketId,
        uint256 unwrapAmount,
        uint256 minAmountReceived
    ) external returns (
        uint256 returnCollateralAmount,
        OrderFees.Data memory fees
    );

    function wrap(
        uint128 marketId,
        uint256 wrapAmount,
        uint256 minAmountReceived
    ) external returns (
        uint256 amountToMint,
        OrderFees.Data memory fees
    );

}