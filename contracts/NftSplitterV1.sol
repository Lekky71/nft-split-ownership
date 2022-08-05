// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract NftSplitterV1 is IERC721Receiver {
    address public _nftContract;
    address _admin;
    mapping(uint256 => NftListing) public _nftListings;
    uint256 public _listingCount;
    uint256 public _LISTING_FEE;
    FNFToken public _fnfToken;

    enum listing_status {
        NOT_EXIST,
        INIT, // when only owner just listed
        IN_PROGRESS, // when first user buys shares
        EXTERNAL_LISTED, // future-use
        EXTERNAL_SOLD // future-use
    }

    struct NftListing {
        uint256 tokenId;
        uint256 salePrice;
        address originalOwner;
        listing_status status;
        uint8 availablePercentage;
        uint8 takenPercentage;
    }

    function initialize(address mainNftContract, address fNFTokenAddress, uint256 listingFee) external {
        _admin = msg.sender;
        _fnfToken = FNFToken(fNFTokenAddress);
        _nftContract = mainNftContract;
        _LISTING_FEE = listingFee;
    }

    modifier onlyAdmin {
        require(msg.sender == _admin);
        _;
    }

    modifier listingExists(uint256 tokenId) {
        require(_nftListings[tokenId].takenPercentage > 0, 'Listing not found');
        _;
    }

    modifier buyingAllowed(uint256 tokenId) {
        require(((_nftListings[tokenId].status == listing_status.INIT) || (_nftListings[tokenId].status == listing_status.IN_PROGRESS)), 'Invalid state');
        _;
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) public override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function listNft(uint256 tokenId, uint256 salePrice, uint8 offerPercentage) public payable returns (bool) {
        // check if msg.sender is the owner of the token
        address tokenOwner = IERC721(_nftContract).ownerOf(tokenId);
        require(msg.sender == tokenOwner, 'You do not own this token');
        require(msg.value == _LISTING_FEE, 'Listing fee not met');
        require(((offerPercentage >= 1) && (offerPercentage <= 100)), "Percentage you wanna sell should be less than or equal to 100");

        uint8 ownerPercentage = (100 - offerPercentage);

        NftListing storage listing = _nftListings[tokenId];
        if ((listing.status == listing_status.INIT) || (listing.status == listing_status.IN_PROGRESS) || (listing.status == listing_status.EXTERNAL_LISTED)) {
            revert('Listing is in invalid state');
        }
        listing.tokenId = tokenId;
        listing.salePrice = salePrice;
        listing.tokenId = tokenId;
        listing.originalOwner = msg.sender;
        listing.status = listing_status.INIT;
        listing.availablePercentage = offerPercentage;
        listing.takenPercentage = ownerPercentage;

        // Collect NFT from user
        IERC721(_nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        // Mint ERC1155 Tokens for lister
        _fnfToken.mint(msg.sender, tokenId, ownerPercentage);
        _listingCount++;

        emit NftListed(msg.sender, tokenId, salePrice, offerPercentage);
        return true;
    }

    function buyFraction(uint256 tokenId, uint8 percentage) public listingExists(tokenId) buyingAllowed(tokenId) payable returns (bool) {
        NftListing storage _nftListing = _nftListings[tokenId];
        uint256 amount = _nftListing.salePrice * percentage;

        require(amount > 0, 'Amount must be greater than 0');
        require(msg.value == amount, '(Sale price * percentage) not met');
        // state updates
        // add/update owner
        // set status
        if (_nftListing.status == listing_status.INIT) {
            _nftListing.status = listing_status.IN_PROGRESS;
        }

        // update availablePercentage;
        _nftListing.availablePercentage -= percentage;
        // update takenPercentage;
        _nftListing.takenPercentage += percentage;
        _fnfToken.mint(msg.sender, tokenId, percentage);

        // transfer eth to owner after
        payable(_nftListing.originalOwner).transfer(amount);
        emit FractionPurchased(msg.sender, tokenId, amount, percentage);
        return true;
    }

    function withdrawMyNft(uint256 tokenId, address to) public listingExists(tokenId) {
        NftListing storage _nftListing = _nftListings[tokenId];
        uint256 erc155Balance = _fnfToken.balanceOf(msg.sender, tokenId);

        if (_nftListing.takenPercentage != erc155Balance) {
            revert('You do not own the whole of this NFT');
        }
        _nftListing.status = listing_status.NOT_EXIST;
        _fnfToken.burn(msg.sender, tokenId, _nftListing.takenPercentage);
        IERC721(_nftContract).safeTransferFrom(address(this), to, tokenId);
    }

    /**
     * @dev For returning after testing, testnet use only
     */
    function withdrawNft(uint256 tokenId, address to) public onlyAdmin {
        IERC721(_nftContract).safeTransferFrom(address(this), to, tokenId);
    }

    function getAdmin() public view returns (address) {
        return _admin;
    }

    event NftListed(address owner, uint256 tokenId, uint256 price, uint8 offerPercentage);
    event FractionPurchased(address buyer, uint256 tokenId, uint256 price, uint8 percentage);

}

contract FNFToken is ERC1155, Ownable {

    constructor() ERC1155("https://ipfs.io/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/") {

    }

    address public admin;

    modifier onlyContract {
        require(msg.sender == admin, 'Mint caller must be admin');
        _;
    }

    function setAdmin(address _admin) public onlyOwner {
        admin = _admin;
    }

    function getAdmin() public view returns (address) {
        return admin;
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount
    ) public onlyContract {
        _mint(to, id, amount, "");
    }

    function burn(
        address account,
        uint256 id,
        uint256 amount
    ) public onlyContract {
        _burn(account, id, amount);
    }
}
