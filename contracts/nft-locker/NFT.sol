// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract NFT is Context, Ownable, ERC721URIStorage {
    uint256 private _nextTokenID;

    constructor(
        address initialOwner_
    ) Ownable(initialOwner_) ERC721("NFT", "NFT") {}

    function safeAirdrop(
        address to_,
        string memory tokenURI_
    ) external onlyOwner {
        _safeMint(to_, _nextTokenID);
        _setTokenURI(_nextTokenID, tokenURI_);
        _nextTokenID++;
    }
}
