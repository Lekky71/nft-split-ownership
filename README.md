# NFT Split Ownership Project

This project is a Smart Contract that makes it possible for ERC721 token holders to list their token for sale in bits.

Equity in an NFT is converted into ERC1155 tokens that can be transferred/sold externally.

A user calls `listNft(uint256 tokenId, uint256 salePrice, uint8 offerPercentage)` to list their item.

A buyer calls `buyFraction(uint256 tokenId, uint8 percentage)`.


Some commands:

```shell
npx hardhat help
npx hardhat test
GAS_REPORT=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts

npx hardhat run scripts/deploy.fnft.v1.ts --network goerli

npx hardhat verify {contractAddress} --network goerli
```
