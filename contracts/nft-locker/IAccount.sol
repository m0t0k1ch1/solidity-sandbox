// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IAccount is IERC721Receiver {
    error UnauthorizedModule(address module);

    event ModuleAuthorized(address indexed module);
    event ModuleUnauthorized(address indexed module);

    event Executed(
        address indexed module,
        address indexed to,
        uint256 value,
        bytes data
    );

    function owner() external view returns (address);

    function isModuleAuthorized(address module) external view returns (bool);

    function authorizeModule(address module) external;

    function unauthorizeModule(address module) external;

    function execute(
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bytes memory);
}
