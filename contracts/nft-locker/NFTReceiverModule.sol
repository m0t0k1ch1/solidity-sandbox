// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {IAccount} from "./IAccount.sol";
import {INFTLocker} from "./INFTLocker.sol";
import {INFT} from "./INFT.sol";

contract NFTReceiverModule is Context, Ownable, IERC721Receiver {
    address public nftLocker;
    uint256 public nftLockDuration;

    error OperatorApprovalExists(uint256 operatorApprovalCount);

    constructor(
        address initialOwner_,
        address nftLocker_,
        uint256 nftLockDuration_
    ) Ownable(initialOwner_) {
        nftLocker = nftLocker_;
        nftLockDuration = nftLockDuration_;
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

        IAccount(owner()).execute(
            nftLocker,
            0,
            abi.encodeWithSignature(
                "lockNFT(address,uint256)",
                _msgSender(),
                block.timestamp + nftLockDuration
            )
        );

        nftContract.safeTransferFrom(address(this), owner(), tokenID_, data_);

        return this.onERC721Received.selector;
    }
}
