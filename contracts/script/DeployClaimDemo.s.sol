// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ClaimDemo.sol";

contract DeployClaimDemo is Script {
    function run() external {
        vm.startBroadcast();

        new ClaimDemo(0x40928DCaE0F83784A22c1827222595ff26eaabEc);

        vm.stopBroadcast();
    }
}
