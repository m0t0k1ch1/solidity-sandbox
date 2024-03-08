// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {IPlugin} from "./IPlugin.sol";

// FOR DEBUG
import "hardhat/console.sol";

contract Plugin is ERC165, IPlugin {
    function supportsInterface(
        bytes4 interfaceID_
    ) public view override returns (bool) {
        return
            interfaceID_ == type(IPlugin).interfaceId ||
            super.supportsInterface(interfaceID_);
    }

    function onInstall(bytes calldata) external pure {
        console.log("onInstall");
    }

    function onUninstall(bytes calldata) external pure {
        console.log("onUninstall");
    }

    function preExecutionHook(
        address caller,
        address target,
        uint256 value,
        bytes calldata data
    ) external {}
}
