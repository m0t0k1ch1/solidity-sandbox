// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {INFT} from "./INFT.sol";
import {INFTLocker} from "./INFTLocker.sol";

contract NFTReceiverModule is Context, Ownable, IERC721Receiver {
    address public nftLocker;

    error OperatorApprovalExists(uint256 operatorApprovalCount);

    constructor(
        address initialOwner_,
        address nftLocker_
    ) Ownable(initialOwner_) {
        nftLocker = nftLocker_;
    }

    function setNFTLocker(address nftLocker_) external onlyOwner {
        nftLocker = nftLocker_;
    }

    function onERC721Received(
        address,
        address,
        uint256 tokenID_,
        bytes calldata data_
    ) external override returns (bytes4) {
        INFT nftContract = INFT(_msgSender());

        uint256 operatorApprovalCount = nftContract.operatorApprovalCountOf(
            owner()
        );
        if (operatorApprovalCount > 0) {
            revert OperatorApprovalExists(operatorApprovalCount);
        }

        nftContract.safeTransferFrom(address(this), owner(), tokenID_, data_);

        return this.onERC721Received.selector;
    }
}
