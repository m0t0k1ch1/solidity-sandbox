// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IAccount} from "./IAccount.sol";

contract Account is Context, Ownable, IAccount {
    mapping(address module => bool) private _isModuleAuthorizeds;

    constructor(
        address initialOwner_,
        address[] memory modules_
    ) Ownable(initialOwner_) {
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

    function owner() public view override(Ownable, IAccount) returns (address) {
        return super.owner();
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
        bytes memory
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}
