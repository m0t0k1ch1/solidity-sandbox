// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {IAccount} from "./IAccount.sol";

contract Account is Context, IAccount {
    address public immutable owner;

    mapping(address module => bool) private _isModuleAuthorizeds;

    constructor(address owner_, address[] memory modules_) {
        owner = owner_;

        for (uint256 i = 0; i < modules_.length; i++) {
            _isModuleAuthorizeds[modules_[i]] = true;
        }
    }

    modifier onlyAuthorizedModule() {
        if (!_isModuleAuthorizeds[_msgSender()]) {
            revert UnauthorizedModule(_msgSender());
        }
        _;
    }

    function isModuleAuthorized(address module_) external view returns (bool) {
        return _isModuleAuthorizeds[module_];
    }

    function authorizeModule(address module_) external onlyAuthorizedModule {
        _isModuleAuthorizeds[module_] = true;

        emit ModuleAuthorized(module_);
    }

    function unauthorizeModule(address module_) external onlyAuthorizedModule {
        _isModuleAuthorizeds[module_] = false;

        emit ModuleUnauthorized(module_);
    }

    function execute(
        address to_,
        uint256 value_,
        bytes calldata data_
    ) external onlyAuthorizedModule returns (bytes memory) {
        (bool success, bytes memory result) = to_.call{value: value_}(data_);
        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }

        emit Executed(_msgSender(), to_, value_, data_);

        return result;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}
