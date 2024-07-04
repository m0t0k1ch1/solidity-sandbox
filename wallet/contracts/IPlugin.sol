// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IPlugin {
    function onInstall(bytes calldata data) external;

    function onUninstall(bytes calldata data) external;

    function preExecutionHook(
        address target,
        uint256 value,
        bytes calldata data
    ) external;
}
