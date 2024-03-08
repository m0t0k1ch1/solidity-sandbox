// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract NFT is ERC721URIStorage {
    uint256 private _nextTokenID;

    constructor() ERC721("NFT", "NFT") {}

    function mint(string calldata tokenURI_) external {
        _safeMint(msg.sender, _nextTokenID);
        _setTokenURI(_nextTokenID, tokenURI_);
        _nextTokenID++;
    }
}
