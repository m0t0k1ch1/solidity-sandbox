// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface INFT is IERC721 {
    error InvalidMinter(address minter);

    function operatorApprovalCountOf(
        address owner
    ) external view returns (uint256);
}
