// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FT is ERC20 {
    constructor(uint256 initialSupply_) ERC20("FT", "FT") {
        _mint(msg.sender, initialSupply_);
    }
}
