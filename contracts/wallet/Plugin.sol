// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {IPlugin} from "./IPlugin.sol";

contract Plugin is ERC165, IPlugin {
    error Guarded(address caller, address target);

    event GuardSet(
        address indexed caller,
        address indexed target,
        uint256 expireAt
    );

    mapping(address account => mapping(address target => uint256 expireAt))
        private _guards;
    mapping(address account => address[] targets) private _targets;

    function supportsInterface(
        bytes4 interfaceID_
    ) public view override returns (bool) {
        return
            interfaceID_ == type(IPlugin).interfaceId ||
            super.supportsInterface(interfaceID_);
    }

    function onInstall(bytes calldata) external {}

    function onUninstall(bytes calldata data_) external {
        address account = abi.decode(data_, (address));

        for (uint256 i = 0; i < _targets[account].length; i++) {
            delete _guards[account][_targets[account][i]];
        }

        delete _targets[account];
    }

    function getGuardExpireAt(
        address caller,
        address target
    ) external view returns (uint256) {
        return _guards[caller][target];
    }

    function setGuard(address target, uint256 expireAt) external {
        _guards[msg.sender][target] = expireAt;
        _targets[msg.sender].push(target);

        emit GuardSet(msg.sender, target, expireAt);
    }

    function preExecutionHook(
        address target_,
        uint256,
        bytes calldata
    ) external view {
        if (block.timestamp < _guards[msg.sender][target_]) {
            revert Guarded(msg.sender, target_);
        }
    }
}
