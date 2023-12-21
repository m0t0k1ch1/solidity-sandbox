// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

import {INFT} from "./INFT.sol";

contract NFT is Context, ERC721URIStorage, INFT {
    address public immutable minter;

    uint256 private _nextTokenID;
    mapping(address owner => uint256) private _operatorApprovalCounts;

    modifier onlyMinter() {
        if (_msgSender() != minter) {
            revert InvalidMinter(_msgSender());
        }
        _;
    }

    constructor(address minter_) ERC721("NFT", "NFT") {
        minter = minter_;
    }

    function safeAirdrop(
        address to_,
        string calldata tokenURI_
    ) external onlyMinter {
        _safeMint(to_, _nextTokenID);
        _setTokenURI(_nextTokenID, tokenURI_);
        _nextTokenID++;
    }

    function setApprovalForAll(
        address operator_,
        bool isApproved_
    ) public override(ERC721, IERC721) {
        bool isApprovedForAllBefore = isApprovedForAll(_msgSender(), operator_);

        super.setApprovalForAll(operator_, isApproved_);

        if (!isApprovedForAllBefore && isApproved_) {
            _operatorApprovalCounts[_msgSender()]++;
        } else if (isApprovedForAllBefore && !isApproved_) {
            _operatorApprovalCounts[_msgSender()]--;
        }
    }

    function operatorApprovalCountOf(
        address owner_
    ) public view returns (uint256) {
        return _operatorApprovalCounts[owner_];
    }
}
