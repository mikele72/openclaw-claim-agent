// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";

contract ClawClaimAgentToken is ERC20, Ownable {
    constructor() ERC20("Claw Claim Agent Token", "CCAT") Ownable(msg.sender) {
        // 1 miliardo di token al deployer
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
