// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {IAccount} from "./IAccount.sol";

contract RelayerModule is Context {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    mapping(address account => uint256) private _nonces;

    error InvalidSignature();

    event Executed(
        address indexed account,
        bytes32 indexed opHash,
        bool indexed success,
        bytes result
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

        _nonces[account_]++;

        (bool success, bytes memory result) = account_.call(opData);

        emit Executed(account_, opHash, success, result);

        return success;
    }

    function _validateSignature(
        address account_,
        bytes32 opHash_,
        bytes memory sig_
    ) private view returns (bool) {
        return
            opHash_.toEthSignedMessageHash().recover(sig_) ==
            IAccount(account_).owner();
    }

    function _getOperationHash(
        address account_,
        bytes memory opData_
    ) public view returns (bytes32) {
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
