// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
import "hardhat/console.sol"; // used in testing purposes

/**
 * @title Testing Contract
 * @author Al-Qa'qa'
 * @notice This contract is for testing executing transaction using TimeLock contract
 */
contract TestTimeLock {
  string private _name = "Al-Qa'qa'";

  function setName(string memory name_) public {
    // console.log("---> setName() <---, name: ", name_);
    // console.log("Caller: ", msg.sender);
    // console.log("Data: ", string(msg.data));
    _name = name_;
  }

  function getName() public view returns (string memory) {
    // console.log("---> getName() <---");
    // console.log("Caller: ", msg.sender);
    // console.log("Data: ", string(msg.data));
    return _name;
  }
}
