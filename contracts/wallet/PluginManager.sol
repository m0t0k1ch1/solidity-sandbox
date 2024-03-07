// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FunctionReference, IERC6900PluginManager} from "./IERC6900PluginManager.sol";

contract PluginManager is IERC6900PluginManager {
    function installPlugin(
        address plugin,
        bytes32 manifestHash,
        bytes calldata pluginInstallData,
        FunctionReference[] calldata dependencies
    ) external {}

    function uninstallPlugin(
        address plugin,
        bytes calldata config,
        bytes calldata pluginUninstallData
    ) external {}
}
