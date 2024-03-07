// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {BaseAccount} from "@account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

import {Call, IERC6900StandardExecutor} from "./IERC6900StandardExecutor.sol";
import {IPlugin} from "./IPlugin.sol";
import {PluginManager} from "./PluginManager.sol";

contract Account is
    UUPSUpgradeable,
    BaseAccount,
    IERC6900StandardExecutor,
    PluginManager
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    error PluginExecutionDenied(address plugin);

    /// @custom:storage-location erc7201:account.main
    struct MainStorage {
        address owner;
        IEntryPoint entryPoint;
    }

    // keccak256(abi.encode(uint256(keccak256("account.main")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant MAIN_STORAGE_LOCATION =
        0x4c26e3de87d6b510c7b0bd325d8fc65d9a252c7959e43999c3f7016ee6412b00;

    modifier native() {
        bytes memory hookData = _doPreExecHook();

        _;

        _doPostExecHook(hookData);
    }

    constructor(address owner_, IEntryPoint entryPoint_) {
        MainStorage storage $ = _getMainStorage();

        $.owner = owner_;
        $.entryPoint = entryPoint_;
    }

    function owner() public view returns (address) {
        MainStorage storage $ = _getMainStorage();

        return $.owner;
    }

    function entryPoint() public view virtual override returns (IEntryPoint) {
        MainStorage storage $ = _getMainStorage();

        return $.entryPoint;
    }

    function upgradeToAndCall(
        address impl_,
        bytes memory data_
    ) public payable override onlyProxy native {
        super.upgradeToAndCall(impl_, data_);
    }

    function execute(
        address target_,
        uint256 value_,
        bytes calldata data_
    ) external payable native returns (bytes memory) {
        return _execute(target_, value_, data_);
    }

    function executeBatch(
        Call[] calldata calls_
    ) external payable native returns (bytes[] memory) {
        bytes[] memory results = new bytes[](calls_.length);

        for (uint256 i = 0; i < calls_.length; i++) {
            results[i] = _execute(
                calls_[i].target,
                calls_[i].value,
                calls_[i].data
            );
        }

        return results;
    }

    function _getMainStorage() private pure returns (MainStorage storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }

    function _validateSignature(
        UserOperation calldata userOp_,
        bytes32 userOpHash_
    ) internal virtual override returns (uint256 validationData) {
        if (
            userOpHash_.toEthSignedMessageHash().recover(userOp_.signature) !=
            owner()
        ) {
            return SIG_VALIDATION_FAILED;
        }

        return 0;
    }

    function _doPreExecHook() private returns (bytes memory) {}

    function _doPostExecHook(bytes memory hookData) private {}

    function _execute(
        address target_,
        uint256 value_,
        bytes memory data_
    ) private returns (bytes memory) {
        if (
            ERC165Checker.supportsInterface(target_, type(IPlugin).interfaceId)
        ) {
            revert PluginExecutionDenied(target_);
        }

        (bool success, bytes memory result) = target_.call{value: value_}(
            data_
        );
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        return result;
    }

    function _authorizeUpgrade(address) internal override {}
}
