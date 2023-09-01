// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol"; // used in testing purposes

/**
 * @title Time Lock Smart contract
 * @author Al-Qa'qa'
 * @notice This contract makes time lock for transaction i.e: delay TXs execution
 */
contract TimeLock is Ownable {
  /// @notice transaction status
  enum TxStatus {
    NOT_QUEUED,
    IN_QUEUE,
    EXPIRED
  }

  ///////////////////////////////
  /// -- Errors And Events -- ///
  ///////////////////////////////

  error TimeLock__AlreadyQueued(bytes32 txId);
  error TimeLock__TimestampNotInRange(uint blockTimestamp, uint timestamp);
  error TimeLock__TimestampNotPassed(uint blockTimestamp, uint timestamp);
  error TimeLock__TxExpired(uint blockTimestamp, uint expiresAt);
  error TimeLock__TxNotQueued(bytes32 txId);
  error TimeLock__TransactionFailed();

  event Queue(bytes32 indexed txId, address indexed target, uint value, bytes data, uint timestamp);
  event Execute(
    bytes32 indexed txId,
    address indexed target,
    uint value,
    bytes data,
    uint timestamp
  );
  event Cancel(bytes32 indexed txId);

  ///////////////////////
  /// -- Variables -- ///
  ///////////////////////

  /// @notice transaction to be executed parameters
  struct Tx {
    address target;
    uint value;
    bytes data;
    uint timestamp;
    TxStatus status;
  }

  uint public constant MIN_DELAY = 1 days; // 1 day
  uint public constant MAX_DELAY = 30 days; // 30 days
  uint public constant GRACE_PERIOD = 7 days; // 7 days

  // Transaction id => Transaction object
  mapping(bytes32 => Tx) public transactions;

  //////////////////////////////////
  /// external & public function ///
  //////////////////////////////////

  /**
   * @notice List new Tx in transaction queue
   *
   * @param _target Contract address or account address to call
   * @param _value ETH amount to be sent
   * @param _data ABI encoded data send
   * @param _timestamp the time in which the function will be open to be executed
   */
  function queue(
    address _target,
    uint _value,
    bytes calldata _data,
    uint _timestamp
  ) external onlyOwner {
    // create tx id
    bytes32 txId = getTxId(_target, _value, _data, _timestamp);

    // If the transaction expired (executed)
    if (transactions[txId].status == TxStatus.EXPIRED) {
      transactions[txId].status = TxStatus.NOT_QUEUED;
    }

    // check tx id is unique
    if (transactions[txId].status != TxStatus.NOT_QUEUED) {
      revert TimeLock__AlreadyQueued(txId);
    }
    // check timestamp
    if (_timestamp < block.timestamp + MIN_DELAY || _timestamp > block.timestamp + MAX_DELAY) {
      revert TimeLock__TimestampNotInRange(block.timestamp, _timestamp);
    }

    // Update transaction params and change its status into `IN_QUEUE`
    _updateTx(txId, _target, _value, _data, _timestamp, TxStatus.IN_QUEUE);

    emit Queue(txId, _target, _value, _data, _timestamp);
  }

  /**
   * @notice calling the transaction that is stored in our transaction mapping that has this ID
   *
   * @param _txId Transaction ID to be executed
   */
  function execute(bytes32 _txId) external payable onlyOwner returns (bytes memory) {
    (address target, uint value, bytes memory data, uint timestamp, TxStatus status) = getTxInfo(
      _txId
    );

    // Check Tx is queued
    if (status != TxStatus.IN_QUEUE) {
      revert TimeLock__TxNotQueued(_txId);
    }

    // Check the block.timestamp > _timestamp
    if (block.timestamp < timestamp) {
      revert TimeLock__TimestampNotPassed(block.timestamp, timestamp);
    }

    if (block.timestamp > timestamp + GRACE_PERIOD) {
      revert TimeLock__TxExpired(block.timestamp, timestamp + GRACE_PERIOD);
    }

    // delete tx from queue
    transactions[_txId].status = TxStatus.EXPIRED;

    // execute the tx
    (bool ok, bytes memory res) = target.call{value: value}(data);
    if (!ok) revert TimeLock__TransactionFailed();

    // string memory stringRes = string(res);
    // console.log("Execution Respond");
    // console.log(stringRes);

    emit Execute(_txId, target, value, data, timestamp);

    // return abi.encode(func);
    return res;
  }

  function cancel(bytes32 _txId) external onlyOwner {
    (, , , , TxStatus status) = getTxInfo(_txId);

    if (status != TxStatus.IN_QUEUE) {
      revert TimeLock__TxNotQueued(_txId);
    }

    transactions[_txId].status = TxStatus.EXPIRED;

    emit Cancel(_txId);
  }

  ///////////////////////////////////
  /// internal & private function ///
  ///////////////////////////////////

  /**
   * @notice update the transaction of the fiven ID parameters
   *
   * @param _txId Transaction ID
   * @param _target Address of contract or account to call
   * @param _value ETH amount to be sent
   * @param _data ABI encoded data send
   * @param _timestamp the time in which the function will be open to be executed
   * @param _status transaction status (queued or not ot expired)
   */
  function _updateTx(
    bytes32 _txId,
    address _target,
    uint _value,
    bytes calldata _data,
    uint _timestamp,
    TxStatus _status
  ) private {
    transactions[_txId].target = _target;
    transactions[_txId].value = _value;
    transactions[_txId].data = _data;
    transactions[_txId].timestamp = _timestamp;
    transactions[_txId].status = _status;
  }

  ////////////////////////////
  /// view & pure function ///
  ////////////////////////////

  /**
   * @notice getting transaciton information using transaction ID
   *
   * @param _txId transaction ID
   * @return target Address of contract or account to call
   * @return value ETH amount to be sent
   * @return data ABI encoded data send
   * @return timestamp the time in which the function will be open to be executed
   * @return status transaction status (queued or not ot expired)
   */
  function getTxInfo(
    bytes32 _txId
  )
    public
    view
    returns (address target, uint value, bytes memory data, uint timestamp, TxStatus status)
  {
    Tx memory transaction = transactions[_txId];

    return (
      transaction.target,
      transaction.value,
      transaction.data,
      transaction.timestamp,
      transaction.status
    );
  }

  /**
   * @notice getting a given transaction ID by passing all transaction arguments, and then
   *         hashing all these values to get a unique ID
   *
   * @dev its using `keccak256` for hashing, and we encode the data first using `abi.encode`
   *
   * @param _target Contract address or account address to call
   * @param _value ETH amount to be sent
   * @param _data ABI encoded data send
   * @param _timestamp the time in which the function will be open to be executed
   */
  function getTxId(
    address _target,
    uint _value,
    bytes calldata _data,
    uint _timestamp
  ) public pure returns (bytes32 txId) {
    return keccak256(abi.encode(_target, _value, _data, _timestamp));
  }
}
