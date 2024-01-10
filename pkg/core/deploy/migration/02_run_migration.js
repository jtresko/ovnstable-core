const {
    getContract,
    execTimelock,
    initWallet, getWalletAddress,
} = require("@overnight-contracts/common/utils/script-utils");
const hre = require("hardhat");
const {ethers} = require("hardhat");
const {Roles} = require("@overnight-contracts/common/utils/roles");
const {getImplementationAddress} = require("@openzeppelin/upgrades-core");
const {expect} = require("chai");
const sampleModule = require("@openzeppelin/hardhat-upgrades/dist/utils/deploy-impl");
const {fromAsset, fromUsdPlus} = require("@overnight-contracts/common/utils/decimals");

module.exports = async () => {

    let isLocalTest = hre.network.name === 'localhost';

    let usdPlus = await getContract('UsdPlusToken');
    let exchange = await getContract('Exchange');
    let wrapped = await getContract('WrappedUsdPlusToken');

    let usdPlusMigrationAddress = '0x02ceEE3481341dBa79C574B1292e074b48587B87';
    let usdPlusPureAddress = '0xdFF59a37eD7187Bf5C6a730C6C201DC00E58f0CC';
    let wrappedPureAddress = '0xbF4864B29a4588244988b7b40EFbE7a77bB04417';
    let exchangeAddress = '0xd486A151E63C344866BF084AD401cF30D3372B71';
    let startBlock = await ethers.provider.getBlockNumber();

    let roleManagerAddress = (await getContract('RoleManager')).address;
    let payoutManagerAddress = (await getContract('TestPayoutManager', 'test')).address;
    let decimals = await usdPlus.decimals();

    if (isLocalTest) {

        console.log('[LocalTest] SetPause');
        await execTimelock(async (timelock) => {
            let roleManager = await getContract('RoleManager');
            await roleManager.connect(timelock).grantRole(Roles.PORTFOLIO_AGENT_ROLE, timelock.address);
            await exchange.connect(timelock).pause();
            await wrapped.connect(timelock).pause();
        })

        // For redeploy migration contract

        // let factory = await ethers.getContractFactory('UsdPlusTokenMigration');
        //
        // let impl = await sampleModule.deployProxyImpl(hre, factory, {
        //     kind: 'uups',
        //     unsafeSkipStorageCheck: true,
        //     unsafeAllowRenames: true
        // }, usdPlus.address);
        //
        // usdPlusMigrationAddress = impl.impl;
    }

    let factory = await ethers.getContractFactory('UsdPlusTokenMigration');
    usdPlus = await ethers.getContractAt(factory.interface, usdPlus.address, await initWallet());

    let exchangePaused = await exchange.paused();
    let wrappedPaused = await wrapped.paused();

    console.log('Pause status');

    console.log(`Exchange.paused: ${exchangePaused}`);
    console.log(`Wrapped.paused:  ${wrappedPaused}`);

    if (!exchangePaused || !wrappedPaused) {
        throw new Error('Exchange or Wrapped not pause!');
    }


    console.log('====[Exchange Upgrade]====');

    console.log('1. upgradeTo');
    console.log(`Exchange implementation address: ${await getImplementationAddress(ethers.provider, exchange.address)}`);
    await (await exchange.upgradeTo(exchangeAddress)).wait();
    console.log(`Exchange implementation address: ${await getImplementationAddress(ethers.provider, exchange.address)}`);

    console.log('2. Set PayoutManager');
    await (await exchange.setPayoutManager(payoutManagerAddress)).wait();
    console.log(`exchange.payoutListener: ${await exchange.payoutManager()}`);
    console.log(`exchange.usdPlus:        ${await exchange.usdPlus()}`);
    console.log(`exchange.pause:          ${await exchange.paused()}`);

    console.log('====[Exchange Upgrade done]====\n\n\n');


    console.log('====[UsdPlus Migration]====');

    console.log('1. upgradeTo(migration)');
    console.log(`usdPlus implementation address: ${await getImplementationAddress(ethers.provider, usdPlus.address)}`);
    await (await usdPlus.upgradeTo(usdPlusMigrationAddress)).wait();
    console.log(`usdPlus implementation address: ${await getImplementationAddress(ethers.provider, usdPlus.address)}`);

    console.log('2. MigrationInit');
    await (await usdPlus.migrationInit(exchange.address, decimals, payoutManagerAddress)).wait();
    console.log(`usdPlus.decimals:       ${await usdPlus.decimals()}`);
    console.log(`usdPlus.payoutManager:  ${await usdPlus.payoutManager()}`);

    console.log('====[UsdPlus Migration done]====\n\n\n');


    console.log('====[UsdPlus Pure]====');

    console.log('1. upgradeTo(pure)');
    console.log(`usdPlus implementation address: ${await getImplementationAddress(ethers.provider, usdPlus.address)}`);
    await (await usdPlus.upgradeTo(usdPlusPureAddress)).wait();
    console.log(`usdPlus implementation address: ${await getImplementationAddress(ethers.provider, usdPlus.address)}`);

    usdPlus = await getContract('UsdPlusToken');
    console.log('2. SetRoleManager');
    await (await usdPlus.setRoleManager(roleManagerAddress)).wait();
    console.log(`usdPlus.roleManager:    ${await usdPlus.roleManager()}`);

    console.log('3. SetPause')
    await (await usdPlus.pause()).wait();


    console.log('====[UsdPlus Pure done]====\n\n\n');

    console.log('====[Wrapped Pure]====');
    console.log(`usdPlus implementation address: ${await getImplementationAddress(ethers.provider, wrapped.address)}`);
    await (await wrapped.upgradeTo(wrappedPureAddress)).wait();
    console.log(`usdPlus implementation address: ${await getImplementationAddress(ethers.provider, wrapped.address)}`);

    expect(roleManagerAddress).to.equal(await usdPlus.roleManager());
    expect(roleManagerAddress).to.equal(await exchange.roleManager());
    expect(payoutManagerAddress).to.equal(await usdPlus.payoutManager());
    expect(payoutManagerAddress).to.equal(await exchange.payoutManager());
    expect(decimals).to.equal(await usdPlus.decimals());
    expect(usdPlusPureAddress).to.equal(await getImplementationAddress(ethers.provider, usdPlus.address));
    expect(exchangeAddress).to.equal(await getImplementationAddress(ethers.provider, exchange.address));
    expect(wrappedPureAddress).to.equal(await getImplementationAddress(ethers.provider, wrapped.address));

    await checksum(usdPlus, exchange, wrapped, startBlock);
};


async function checksum(usdPlus, exchange, wrapped, startBlock) {

    console.log('[checksum]');
    let items = [];

    let ownerLength = await usdPlus.ownerLength();

    let walletAddress = await getWalletAddress();

    let indexFirstUser = await usdPlus.ownerAt(0);
    let indexMiddleUser = await usdPlus.ownerAt(Math.ceil(ownerLength / 2));
    let indexLastUser = await usdPlus.ownerAt(ownerLength - 1);


    items.push(
        {
            name: 'Decimals',
            old: await usdPlus.decimals({blockTag: startBlock}),
            new: await usdPlus.decimals()
        },
        {
            name: 'Symbol',
            old: await usdPlus.symbol({blockTag: startBlock}),
            new: await usdPlus.symbol()
        },
        {
            name: 'Name',
            old: await usdPlus.name({blockTag: startBlock}),
            new: await usdPlus.name()
        },
        {
            name: 'ownerLength',
            old: (await usdPlus.ownerLength({blockTag: startBlock})).toString(),
            new: (await usdPlus.ownerLength()).toString()
        },
        {
            name: 'totalSupply',
            old: (await usdPlus.totalSupply({blockTag: startBlock})).toString(),
            new: (await usdPlus.totalSupply()).toString()
        },
        {
            name: 'totalSupplyOwners',
            old: '-',
            new: (await usdPlus.totalSupplyOwners()).toString()
        },
        {
            name: 'exchange',
            old: (await usdPlus.exchange({blockTag: startBlock})).toString(),
            new: (await usdPlus.exchange()).toString()
        },
        {
            name: 'wrapped.getRate',
            old: (await wrapped.rate({blockTag: 	startBlock})).toString(),
            new: (await wrapped.rate()).toString()
        },
        {
            name: 'wrapped.totalSupply',
            old: (await wrapped.totalSupply({blockTag: startBlock})).toString(),
            new: (await wrapped.totalSupply()).toString()
        },
        {
            name: 'usdPlus_user_first',
            old: fromUsdPlus(await usdPlus.balanceOf(indexFirstUser, {blockTag: startBlock})),
            new: fromUsdPlus(await usdPlus.balanceOf(indexFirstUser))
        },
        {
            name: 'usdPlus_user_middle',
            old: fromUsdPlus(await usdPlus.balanceOf(indexMiddleUser, {blockTag: startBlock})),
            new: fromUsdPlus(await usdPlus.balanceOf(indexMiddleUser))
        },
        {
            name: 'usdPlus_user_last',
            old: fromUsdPlus(await usdPlus.balanceOf(indexLastUser, {blockTag: startBlock})),
            new: fromUsdPlus(await usdPlus.balanceOf(indexLastUser))
        },
        {
            name: 'usdPlus_user_dev',
            old: fromUsdPlus(await usdPlus.balanceOf(walletAddress, {blockTag: startBlock})),
            new: fromUsdPlus(await usdPlus.balanceOf(walletAddress))
        },
        {
            name: 'wrapped_user_dev',
            old: fromUsdPlus(await wrapped.balanceOf(walletAddress, {blockTag: startBlock})),
            new: fromUsdPlus(await wrapped.balanceOf(walletAddress))
        }
    )

    console.table(items);
}


module.exports.tags = ['RunMigration'];