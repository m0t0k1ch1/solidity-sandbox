// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {BaseAccount} from "@account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "@account-abstraction/contracts/interfaces/UserOperation.sol";

import {IPlugin} from "./IPlugin.sol";

contract Account is Initializable, UUPSUpgradeable, BaseAccount {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    error UnauthorizedCaller(address caller);
    error PluginInterfaceNotSupported(address plugin);
    error PluginAlreadyInstalled(address plugin);
    error PluginAlreadyUninstalled();

    event PluginInstalled(address plugin);
    event PluginUninstalled(address plugin);

    /// @custom:storage-location erc7201:account.main
    struct AccountMainStorage {
        address owner;
        IEntryPoint entryPoint;
        address plugin;
    }

    // keccak256(abi.encode(uint256(keccak256("account.main")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant _ACCOUNT_MAIN_STORAGE_LOCATION =
        0x4c26e3de87d6b510c7b0bd325d8fc65d9a252c7959e43999c3f7016ee6412b00;

    modifier onlyFromOwnerOrEntryPoint() {
        AccountMainStorage storage $ = _getAccountMainStorage();

        if (msg.sender != $.owner && msg.sender != address($.entryPoint)) {
            revert UnauthorizedCaller(msg.sender);
        }

        _;
    }

    modifier onlyFromSelf() {
        if (msg.sender != address(this)) {
            revert UnauthorizedCaller(msg.sender);
        }

        _;
    }

    constructor(address owner_, IEntryPoint entryPoint_) {
        initialize(owner_, entryPoint_);
    }

    function initialize(
        address owner_,
        IEntryPoint entryPoint_
    ) public initializer {
        AccountMainStorage storage $ = _getAccountMainStorage();

        $.owner = owner_;
        $.entryPoint = entryPoint_;
    }

    function owner() public view returns (address) {
        AccountMainStorage storage $ = _getAccountMainStorage();

        return $.owner;
    }

    function entryPoint() public view virtual override returns (IEntryPoint) {
        AccountMainStorage storage $ = _getAccountMainStorage();

        return $.entryPoint;
    }

    function upgradeToAndCall(
        address impl_,
        bytes memory data_
    ) public payable override onlyProxy onlyFromSelf {
        super.upgradeToAndCall(impl_, data_);
    }

    function installPlugin(
        address plugin_,
        bytes calldata data_
    ) external onlyFromSelf {
        AccountMainStorage storage $ = _getAccountMainStorage();

        if (address($.plugin) != address(0)) {
            revert PluginAlreadyInstalled(plugin_);
        }

        if (
            !ERC165Checker.supportsInterface(plugin_, type(IPlugin).interfaceId)
        ) {
            revert PluginInterfaceNotSupported(plugin_);
        }

        $.plugin = plugin_;
        IPlugin(plugin_).onInstall(data_);

        emit PluginInstalled(plugin_);
    }

    function uninstallPlugin(bytes calldata data_) external onlyFromSelf {
        AccountMainStorage storage $ = _getAccountMainStorage();

        if (address($.plugin) == address(0)) {
            revert PluginAlreadyUninstalled();
        }

        address plugin = $.plugin;

        delete $.plugin;
        IPlugin(plugin).onUninstall(data_);

        emit PluginUninstalled(plugin);
    }

    function execute(
        address target_,
        uint256 value_,
        bytes calldata data_
    ) external payable onlyFromOwnerOrEntryPoint returns (bytes memory) {
        AccountMainStorage storage $ = _getAccountMainStorage();

        if ($.plugin != address(0)) {
            IPlugin($.plugin).preExecutionHook(
                msg.sender,
                target_,
                value_,
                data_
            );
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

    receive() external payable {}

    function _getAccountMainStorage()
        private
        pure
        returns (AccountMainStorage storage $)
    {
        assembly {
            $.slot := _ACCOUNT_MAIN_STORAGE_LOCATION
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

    function _authorizeUpgrade(address) internal override {}
}
