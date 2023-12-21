// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IAccount} from "./IAccount.sol";

contract RelayerModule is Context {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    mapping(address account => uint256) private _nonces;
    mapping(address account => mapping(address nft => uint256 expireAt))
        private _nftLockExpireAts;

    error InvalidSignature();
    error InvalidOperation();
    error NFTAlreadyLocked();

    event Executed(
        address indexed account,
        bytes32 indexed opHash,
        bool indexed success,
        bytes result
    );

    event NFTLocked(
        address indexed account,
        address indexed nft,
        uint256 expireAt
    );

    function nonceOf(address account_) external view returns (uint256) {
        return _nonces[account_];
    }

    function execute(
        address account_,
        address to_,
        uint256 value_,
        bytes calldata data_,
        bytes calldata sig_
    ) external returns (bool) {
        bytes memory opData = abi.encodeWithSignature(
            "execute(address,uint256,bytes)",
            to_,
            value_,
            data_
        );
        bytes32 opHash = _getOperationHash(account_, opData);

        if (!_validateSignature(account_, opHash, sig_)) {
            revert InvalidSignature();
        }

        if (
            !_validateOperation(
                account_,
                to_,
                value_,
                bytes4(data_[:4]),
                data_[4:]
            )
        ) {
            revert InvalidOperation();
        }

        _nonces[account_]++;

        (bool success, bytes memory result) = account_.call(opData);

        emit Executed(account_, opHash, success, result);

        return success;
    }

    function getNFTLockExpireAt(
        address account_,
        address nft_
    ) external view returns (uint256) {
        return _nftLockExpireAts[account_][nft_];
    }

    function lockNFT(address nft_, uint256 expireAt_) external {
        uint256 expireAt = _nftLockExpireAts[_msgSender()][nft_];
        if (expireAt > 0 && block.timestamp < expireAt) {
            revert NFTAlreadyLocked();
        }

        _nftLockExpireAts[_msgSender()][nft_] = expireAt_;

        emit NFTLocked(_msgSender(), nft_, expireAt_);
    }

    function _validateSignature(
        address account_,
        bytes32 opHash_,
        bytes calldata sig_
    ) private view returns (bool) {
        return
            opHash_.toEthSignedMessageHash().recover(sig_) ==
            IAccount(account_).owner();
    }

    function _validateOperation(
        address account_,
        address to_,
        uint256,
        bytes4 functionSelector_,
        bytes memory
    ) private view returns (bool) {
        try IERC165(to_).supportsInterface(type(IERC721).interfaceId) returns (
            bool ok
        ) {
            if (ok) {
                if (
                    functionSelector_ == 0x23b872dd || // transferFrom(address,address,uint256)
                    functionSelector_ == 0x42842e0e || // safeTransferFrom(address,address,uint256)
                    functionSelector_ == 0xb88d4fde || // safeTransferFrom(address,address,uint256,bytes)
                    functionSelector_ == 0x095ea7b3 || // approve(address,uint256)
                    functionSelector_ == 0xa22cb465 // setApprovalForAll(address,bool)
                ) {
                    uint256 expireAt = _nftLockExpireAts[account_][to_];
                    if (expireAt > 0 && block.timestamp < expireAt) {
                        return false;
                    }
                }
            }
        } catch {}

        return true;
    }

    function _getOperationHash(
        address account_,
        bytes memory opData_
    ) private view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    bytes1(0x19),
                    bytes1(0x0),
                    block.chainid,
                    address(this),
                    account_,
                    _nonces[account_],
                    opData_
                )
            );
    }
}
