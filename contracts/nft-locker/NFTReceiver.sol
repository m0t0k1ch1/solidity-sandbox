// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract NFTReceiver is Context, Ownable, IERC721Receiver {
    constructor(address initialOwner_) Ownable(initialOwner_) {}

    function onERC721Received(
        address,
        address,
        uint256 tokenID_,
        bytes memory data_
    ) external override returns (bytes4) {
        IERC721(_msgSender()).safeTransferFrom(
            address(this),
            owner(),
            tokenID_,
            data_
        );

        return this.onERC721Received.selector;
    }
}
