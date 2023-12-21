// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

error UnauthorizedModule(address module);

contract Account is Context, Ownable, IERC721Receiver {
    event ModuleAuthorized(address indexed module);
    event ModuleUnauthorized(address indexed module);

    event Executed(
        address indexed module,
        address indexed to,
        uint256 value,
        bytes data
    );

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

    function isModuleAuthorized(address module_) public view returns (bool) {
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
    ) external payable onlyAuthorizedModule returns (bytes memory) {
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
