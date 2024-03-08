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
import {AccountStorage} from "./AccountStorage.sol";

contract Account is
    Initializable,
    UUPSUpgradeable,
    BaseAccount,
    AccountStorage
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    error UnauthorizedCaller(address caller);
    error PluginInterfaceNotSupported(address plugin);
    error PluginAlreadyInstalled(address plugin);
    error PluginAlreadyUninstalled();

    event PluginInstalled(address indexed plugin);
    event PluginUninstalled(address indexed plugin);

    modifier onlyFromOwnerOrEntryPoint() {
        if (msg.sender != owner() && msg.sender != address(entryPoint())) {
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
        return _getAccountMainStorage().owner;
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return _getAccountMainStorage().entryPoint;
    }

    function plugin() public view returns (address) {
        return _getAccountMainStorage().plugin;
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

        address plugin_ = $.plugin;

        if (address($.plugin) == address(0)) {
            revert PluginAlreadyUninstalled();
        }

        delete $.plugin;
        IPlugin(plugin_).onUninstall(data_);

        emit PluginUninstalled(plugin_);
    }

    function execute(
        address target_,
        uint256 value_,
        bytes calldata data_
    ) external payable onlyFromOwnerOrEntryPoint returns (bytes memory) {
        AccountMainStorage storage $ = _getAccountMainStorage();

        if ($.plugin != address(0)) {
            IPlugin($.plugin).preExecutionHook(target_, value_, data_);
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

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {}

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
