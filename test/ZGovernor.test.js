const { expectRevert, time } = require('@openzeppelin/test-helpers');
const ethers = require('ethers');
const YFNOne = artifacts.require('YFNOne');
const YFNOEngine = artifacts.require('YFNOEngine');
const Timelock = artifacts.require('Timelock');
const GovernorAlpha = artifacts.require('GovernorAlpha');
const MockERC20 = artifacts.require('MockERC20');

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('Governor', ([alice, minter, dev]) => {
    it('should work', async () => {
        this.yfnoToken = await YFNOne.new({ from: alice });
        await this.yfnoToken.delegate(dev, { from: dev });
        this.YFNOEngine = await YFNOEngine.new(this.yfnoToken.address, dev, '100', '0', '0', { from: alice });
        await this.yfnoToken.transferOwnership(this.YFNOEngine.address, { from: alice });
        this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
        this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
        await this.YFNOEngine.add('100', this.lp.address, true, { from: alice });
        await this.lp.approve(this.YFNOEngine.address, '1000', { from: minter });
        await this.YFNOEngine.deposit(0, '100', { from: minter });
        // Perform another deposit to make sure some LEMONs are minted in that 1 block.
        await this.YFNOEngine.deposit(0, '100', { from: minter });
        assert.equal((await this.yfnoToken.totalSupply()).valueOf(), '110');
        assert.equal((await this.yfnoToken.balanceOf(minter)).valueOf(), '100');
        assert.equal((await this.yfnoToken.balanceOf(dev)).valueOf(), '10');
        // Transfer ownership to timelock contract
        this.timelock = await Timelock.new(alice, time.duration.days(2), { from: alice });
        this.gov = await GovernorAlpha.new(this.timelock.address, this.yfnoToken.address, alice, { from: alice });
        await this.timelock.setPendingAdmin(this.gov.address, { from: alice });
        await this.gov.__acceptAdmin({ from: alice });
        await this.YFNOEngine.transferOwnership(this.timelock.address, { from: alice });
        await expectRevert(
            this.YFNOEngine.add('100', this.lp2.address, true, { from: alice }),
            'Ownable: caller is not the owner',
        );
        await expectRevert(
            this.gov.propose(
                [this.YFNOEngine.address], ['0'], ['add(uint256,address,bool)'],
                [encodeParameters(['uint256', 'address', 'bool'], ['100', this.lp2.address, true])],
                'Add LP2',
                { from: alice },
            ),
            'GovernorAlpha::propose: proposer votes below proposal threshold',
        );
        await this.gov.propose(
            [this.YFNOEngine.address], ['0'], ['add(uint256,address,bool)'],
            [encodeParameters(['uint256', 'address', 'bool'], ['100', this.lp2.address, true])],
            'Add LP2',
            { from: dev },
        );
        await time.advanceBlock();
        await this.gov.castVote('1', true, { from: dev });
        await expectRevert(this.gov.queue('1'), "GovernorAlpha::queue: proposal can only be queued if it is succeeded");
        console.log("Advancing 17280 blocks. Will take a while...");
        for (let i = 0; i < 17280; ++i) {
            await time.advanceBlock();
        }
        await this.gov.queue('1');
        await expectRevert(this.gov.execute('1'), "Timelock::executeTransaction: Transaction hasn't surpassed time lock.");
        await time.increase(time.duration.days(3));
        await this.gov.execute('1');
        assert.equal((await this.YFNOEngine.poolLength()).valueOf(), '2');
    });
});
