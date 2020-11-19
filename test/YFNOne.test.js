const { expectRevert } = require('@openzeppelin/test-helpers');
const YFNOne = artifacts.require('YFNOne');

contract('YFNOne', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.yfnoToken = await YFNOne.new({ from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.yfnoToken.name();
        const symbol = await this.yfnoToken.symbol();
        const decimals = await this.yfnoToken.decimals();
        assert.equal(name.valueOf(), 'YFNOne');
        assert.equal(symbol.valueOf(), 'YFNO');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.yfnoToken.mint(alice, '100', { from: alice });
        await this.yfnoToken.mint(bob, '1000', { from: alice });
        await expectRevert(
            this.yfnoToken.mint(carol, '1000', { from: bob }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.yfnoToken.totalSupply();
        const aliceBal = await this.yfnoToken.balanceOf(alice);
        const bobBal = await this.yfnoToken.balanceOf(bob);
        const carolBal = await this.yfnoToken.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.yfnoToken.mint(alice, '100', { from: alice });
        await this.yfnoToken.mint(bob, '1000', { from: alice });
        await this.yfnoToken.transfer(carol, '10', { from: alice });
        await this.yfnoToken.transfer(carol, '100', { from: bob });
        const totalSupply = await this.yfnoToken.totalSupply();
        const aliceBal = await this.yfnoToken.balanceOf(alice);
        const bobBal = await this.yfnoToken.balanceOf(bob);
        const carolBal = await this.yfnoToken.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.yfnoToken.mint(alice, '100', { from: alice });
        await expectRevert(
            this.yfnoToken.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.yfnoToken.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });
  });
