// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface INFTLocker {
    function getNFTLockExpireAt(
        address account,
        address nft
    ) external view returns (uint256);

    function lockNFT(address nft, uint256 expireAt) external;
}
