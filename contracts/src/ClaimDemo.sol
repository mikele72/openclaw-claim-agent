// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ClawClaimAgentToken.sol";

contract ClaimDemo {
    ClawClaimAgentToken public immutable token;

    // quante "credits" claimabili ha ogni wallet
    mapping(address => uint256) public claimable;

    event ClaimableSet(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    constructor(address tokenAddress) {
        token = ClawClaimAgentToken(tokenAddress);
    }

    // Admin (deployer) può settare claimable per demo
    function setClaimable(address user, uint256 amount) external {
        // per MVP: lasciamo aperto (poi mettiamo access control)
        claimable[user] = amount;
        emit ClaimableSet(user, amount);
    }

    function claimReward() external {
        uint256 amount = claimable[msg.sender];
        require(amount > 0, "Nothing to claim");

        claimable[msg.sender] = 0;

        // manda token al claimer (serve che ClaimDemo abbia allowance o sia owner minter)
        token.mint(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }
}
