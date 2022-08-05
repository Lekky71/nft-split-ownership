import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { FNFToken, HuskyArt, NftSplitterV1 } from '../typechain';

const SALE_PRICE = ethers.utils.parseEther("0.5");
const TOKEN_ID = 0;
describe('NftSplitter', () => {

  async function deployNftSplitter(mintErc721 = false) {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    //
    const FNFToken = await ethers.getContractFactory("FNFToken");
    const fnFToken = await FNFToken.deploy();

    let nftAddress = '0x41edd58578FFF43Fbe3081f48C0d4F46635DA7f0';
    let huskyArt;
    if (mintErc721) {
      const HuskyArt = await ethers.getContractFactory("HuskyArt");
      huskyArt = await HuskyArt.deploy();
      nftAddress = huskyArt.address;
    }

    const NftSplitterV1 = await ethers.getContractFactory("NftSplitterV1");
    const nftSplitterV1 = await upgrades.deployProxy(NftSplitterV1,
      [nftAddress, fnFToken.address, 5000000000000000], {
        initializer: 'initialize'
      });

    const nftSplitter = await nftSplitterV1.deployed();

    return { huskyArt, fnFToken, nftSplitter, owner, otherAccount };
  }

  async function listNft() {
    const { huskyArt, fnFToken, nftSplitter, owner, otherAccount } = await deployNftSplitter(true);
    await fnFToken.setAdmin(nftSplitter.address);
    await huskyArt!.safeMint(otherAccount.address, 'https://opensea.mypinata.cloud/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/7440');
    await huskyArt!.connect(otherAccount).approve(nftSplitter.address, TOKEN_ID);

    const listingResult = await nftSplitter.connect(otherAccount).listNft(TOKEN_ID, SALE_PRICE, 40, {
      value: ethers.utils.parseEther("0.005")
    });

    return { listingResult, huskyArt, fnFToken, nftSplitter, owner, otherAccount };
  }

  describe('Deployment', () => {
    it('should set admin address to owner', async () => {
      const { nftSplitter, owner } = await deployNftSplitter();
      console.log(await nftSplitter.getAdmin());
      expect(await nftSplitter.getAdmin()).equal(owner.address);
    });
  });

  describe('Set erc1155 admin', () => {
    it('should set ERC1155 admin', async () => {
      const { fnFToken, nftSplitter } = await deployNftSplitter();
      await fnFToken.setAdmin(nftSplitter.address);
      expect(await fnFToken.getAdmin()).equal(nftSplitter.address);
    });
  });

  describe('List NFT', () => {
    it('should revert "You do not own this token"', async () => {
      const { huskyArt, fnFToken, nftSplitter, otherAccount } = await deployNftSplitter(true);
      await fnFToken.setAdmin(nftSplitter.address);
      await huskyArt!.safeMint(otherAccount.address, 'https://opensea.mypinata.cloud/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/7440');
      try {
        await nftSplitter.listNft(TOKEN_ID, ethers.utils.parseEther("0.5"), 40, {
          value: ethers.utils.parseEther("0.005")
        });
      } catch (err: any) {
        expect(err.message).include('You do not own this token');
      }
    });

    it('should revert lower listing fee sent', async () => {
      const { huskyArt, fnFToken, nftSplitter, otherAccount } = await deployNftSplitter(true);
      await fnFToken.setAdmin(nftSplitter.address);
      await huskyArt!.safeMint(otherAccount.address, 'https://opensea.mypinata.cloud/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/7440');
      try {
        await nftSplitter.connect(otherAccount).listNft(TOKEN_ID, ethers.utils.parseEther("0.5"), 40, {
          value: ethers.utils.parseEther("0.004")
        });
      } catch (err: any) {
        expect(err.message).include('Listing fee not met');
      }
    });

    it('should list NFT', async () => {
      await listNft();
    });
  });

  describe('buyFraction', () => {
    it('should revert amount is low (Sale price * percentage)', async () => {
      const { nftSplitter } = await listNft();
      try {
        await nftSplitter.buyFraction(TOKEN_ID, 10, {
            value: ethers.utils.parseEther("0.005")
          }
        );
      } catch (err: any) {
        expect(err.message).include('(Sale price * percentage)');
      }
    });

    it('should buy fraction successfully', async () => {
      const { nftSplitter, owner, fnFToken } = await listNft();
      await nftSplitter.buyFraction(TOKEN_ID, 10, {
          value: SALE_PRICE.mul(10),
        }
      );
      const userBalance = await fnFToken.balanceOf(owner.address, TOKEN_ID);
      expect(userBalance).equal(10);
    });

    it('should buy more fraction successfully', async () => {
      const { nftSplitter, owner, fnFToken } = await listNft();
      await nftSplitter.buyFraction(TOKEN_ID, 10, {
          value: SALE_PRICE.mul(10),
        }
      );
      await nftSplitter.buyFraction(TOKEN_ID, 2, {
          value: SALE_PRICE.mul(2),
        }
      );
      const userBalance = await fnFToken.balanceOf(owner.address, TOKEN_ID);
      expect(userBalance).equal(12);
    });


    it('lister should buy more fraction successfully', async () => {
      const { nftSplitter, otherAccount, fnFToken } = await listNft();
      await nftSplitter.connect(otherAccount).buyFraction(TOKEN_ID, 32, {
          value: SALE_PRICE.mul(32),
        }
      );
      const userBalance = await fnFToken.balanceOf(otherAccount.address, TOKEN_ID);
      expect(userBalance).equal(92);
    });

  });

  describe('withdraw<yNfT', () => {
    it('should revert user does not own all NFT', async () => {
      const { nftSplitter, otherAccount } = await listNft();
      try {
        await nftSplitter.buyFraction(TOKEN_ID, 10, {
            value: SALE_PRICE.mul(10),
          }
        );
        await nftSplitter.connect(otherAccount).withdrawMyNft(TOKEN_ID, otherAccount.address);
      } catch (err: any) {
        expect(err.message).include('You do not own the whole of this NFT');
      }
    });

    it('should burn user erc1155 and return erc721', async () => {
      const { huskyArt, fnFToken, nftSplitter, otherAccount } = await listNft();
      // noinspection DuplicatedCode
      await nftSplitter.connect(otherAccount).withdrawMyNft(TOKEN_ID, otherAccount.address);
      const userBalance = await fnFToken.balanceOf(otherAccount.address, TOKEN_ID);
      const erc721Balance = await huskyArt!.balanceOf(otherAccount.address);
      expect(userBalance).equal(0);
      expect(erc721Balance).equal(1);
    });

    it('should withdraw NFT after ERC1155 secondary sale or transfer back to token holder', async () => {
      const { huskyArt, fnFToken, nftSplitter, owner, otherAccount } = await listNft();
      await nftSplitter.buyFraction(TOKEN_ID, 10, {
          value: SALE_PRICE.mul(10),
        }
      );
      await fnFToken.safeTransferFrom(owner.address, otherAccount.address, TOKEN_ID, 10, '0x');
      await nftSplitter.connect(otherAccount).withdrawMyNft(TOKEN_ID, otherAccount.address);

      const userBalance = await fnFToken.balanceOf(otherAccount.address, TOKEN_ID);
      const erc721Balance = await huskyArt!.balanceOf(otherAccount.address);
      expect(userBalance).equal(0);
      expect(erc721Balance).equal(1);
    });

  });

});
