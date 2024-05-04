# Overnight Contracts

This repository contains all contracts Overnight

##### Requirement:

- Node v16
- yarn v1.22.18

## README navigation

- [Strategies](./pkg/strategies/README.md)
- [Proposals](./pkg/proposals/README.md)

## How to install?

1. Install node
2. Install yarn
3. Run `yarn install --frozen-lockfile`
4. Create .env file from copy .env.example

### For local developing

1. Define ETH*NODE_URI*{CHAIN} - public RPC
2. Define HARDHAT*BLOCK_NUMBER*{CHAIN} - blockNumber for startup hardhat node
3. Define ETH_NETWORK - chain ID [OPTIMISM, ARBITRUM and etc.]
4. Define STAND - stand id [polygon, bsc, bsc_usdt, optimism_dai and etc.]
5. Define PK - private key [can be any test key]

### For deploy

1. Define PK - if you need to deploy contracts to real chain
2. Define ETHERSCAN*API*${CHAIN} - for verify contracts

```
enum CHAIN:

- POLYGON
- OPTIMISM
- BSC
- BASE
- ARBITRUM
- ZKSYNC
- LINEA

```

## Modules:

This repository contains is next modules:

1. common - it contains common scripts for deploying, build, testing contracts
2. connectors - interfaces/libraries for integration with other protocols
3. core - core contracts: UsdPlusToken/Exchange and etc.
4. governance - new governance contracts
5. lockup - contracts for lock OVN tokens
6. market - ZapIns and WrappedUsdPlus contracts
7. proposals - governance proposals
8. strategies - contains sub modules with strategies for each chain

## Tutorials [NOT ACTUAL]

### How to deploy new core:

1. Set in .env file your parameters and check actual gas price in gas station.
2. Deploy core and setting in pkg/core
   npx hardhat deploy --tags base,setting --network bsc_usdt
3. Run base setting in pkg/core
   npx hardhat run scripts/base-setting.js --network bsc_usdt
4. Verify core in pkg/core and verify it on scan service.
   npx hardhat run scripts/verify.js --network bsc_usdt
5. Deploy market and setting in pkg/market
   npx hardhat deploy --tags base,setting --network bsc_usdt
6. Verify market in pkg/market and verify it on scan service.
   npx hardhat run scripts/verify.js --network bsc_usdt
7. Deploy cash strategy and setting in pkg/strategies/bsc
   npx hardhat deploy --tags StrategyVenusUsdt --setting --network bsc_usdt
8. Verify cash strategy in pkg/strategies/bsc and verify it on scan service.
   npx hardhat run scripts/verify.js --network bsc_usdt
9. Set PM by cash strategy in pkg/core
   npx hardhat run scripts/set-strategies-bsc-usdt.js --network bsc_usdt
10. Deploy new governance if new chain. Copy governance files if same chain
11. Move rules of core contracts to governance in pkg/governance
    npx hardhat run scripts/move_core_to_gov.js --network bsc_usdt
12. Add cash strategy in core.strategies and core contracts in dict.contracts.
13. Set percentage in core.collateral after adding liquidity in cash strategy.

### How to deploy new strategy:

1. Set in .env file your parameters and check actual gas price in gas station
2. Deploy strategy in pkg/strategies/networkName
   npx hardhat deploy --tags StrategyName --setting --network networkName
3. Verify strategy in pkg/strategies/networkName and verify it on scan service
   npx hardhat run scripts/verify.js --network networkName
4. Add new record in core.strategies, core.collateral and dict.tokens (if it needs)
5. Add strategy in PM through proposal in pkg/proposals
   npx hardhat run scripts/proposalName.js --network networkName
6. Move rules of strategy to governance in pkg/governance
   npx hardhat run scripts/move_strategies_to_gov.js --network networkName
