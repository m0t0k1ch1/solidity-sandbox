// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {IAccount} from "./IAccount.sol";
import {INFT} from "./INFT.sol";

contract NFTReceiverModule is Context, IERC721Receiver {
    address public immutable owner;
    address public immutable nftLocker;

    error InvalidOwner(address owner);
    error OperatorApprovalExists(uint256 operatorApprovalCount);

    modifier onlyOwner() {
        if (_msgSender() != owner) {
            revert InvalidOwner(_msgSender());
        }
        _;
    }

    constructor(address owner_, address nftLocker_) {
        owner = owner_;
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
            owner
        );
        if (operatorApprovalCount > 0) {
            revert OperatorApprovalExists(operatorApprovalCount);
        }

        uint256 nftLockDuration = abi.decode(data_, (uint256));

        IAccount(owner).execute(
            nftLocker,
            0,
            abi.encodeWithSignature(
                "lockNFT(address,uint256)",
                _msgSender(),
                block.timestamp + nftLockDuration
            )
        );

        nftContract.safeTransferFrom(address(this), owner, tokenID_, data_);

        return this.onERC721Received.selector;
    }
}
