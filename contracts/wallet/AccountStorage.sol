// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract AccountStorage {
    // keccak256(abi.encode(uint256(keccak256("account.main")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant _ACCOUNT_MAIN_STORAGE_LOCATION =
        0x4c26e3de87d6b510c7b0bd325d8fc65d9a252c7959e43999c3f7016ee6412b00;

    /// @custom:storage-location erc7201:account.main
    struct AccountMainStorage {
        address owner;
        IEntryPoint entryPoint;
        address plugin;
    }

    function _getAccountMainStorage()
        internal
        pure
        returns (AccountMainStorage storage $)
    {
        assembly {
            $.slot := _ACCOUNT_MAIN_STORAGE_LOCATION
        }
    }
}
