// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MediVault {
    address public governance; // deployer / consortium admin
    uint256 public emergencyThreshold; // number of approvals required for emergency access
    uint256 public emergencyWindow = 1 hours; // how long emergency access lasts after threshold reached

    constructor(address[] memory initialAdmins, uint256 _threshold) {
        require(_threshold > 0 && _threshold <= initialAdmins.length, "invalid threshold");
        governance = msg.sender;
        emergencyThreshold = _threshold;
        for (uint i = 0; i < initialAdmins.length; i++) {
            _isEmergencyAdmin[initialAdmins[i]] = true;
        }
    }

    // --------------------- Roles ---------------------
    mapping(address => bool) public isProvider;        // hospitals, labs, doctors
    mapping(address => bool) private _isEmergencyAdmin; // authorized to approve emergency access

    modifier onlyGovernance() {
        require(msg.sender == governance, "only governance");
        _;
    }

    modifier onlyProvider() {
        require(isProvider[msg.sender], "only provider");
        _;
    }

    // Governance functions to manage providers and emergency admins
    function addProvider(address _provider) external onlyGovernance {
        isProvider[_provider] = true;
    }

    function removeProvider(address _provider) external onlyGovernance {
        isProvider[_provider] = false;
    }

    function setEmergencyAdmin(address _admin, bool enabled) external onlyGovernance {
        _isEmergencyAdmin[_admin] = enabled;
    }

    function changeEmergencyThreshold(uint256 _threshold) external onlyGovernance {
        emergencyThreshold = _threshold;
    }

    // --------------------- Records & Access ---------------------
    struct Record {
        address owner;          // patient who owns the record reference
        bytes cid;              // CID bytes (kept compact) - store as bytes to accept v0/v1 forms
        bytes32 sha256Hash;     // SHA-256 of encrypted blob (on-chain verification value)
        uint256 createdAt;      // timestamp when registered
        string meta;            // short metadata JSON/string (non-sensitive)
    }

    // A simple incremental record id; predictable but small
    uint256 private _nextRecordId = 1;
    mapping(uint256 => Record) public records;

    // Access control: mapping recordId => address => accessExpiry (0 if not granted)
    mapping(uint256 => mapping(address => uint256)) public accessExpiry;

    // Access requests stored and visible on-chain
    enum RequestStatus { None, Pending, Granted, Revoked }
    struct AccessRequest {
        address requester;
        uint256 requestedAt;
        RequestStatus status;
        string purpose; // short purpose or reason
    }
    // mapping record -> requestId -> AccessRequest ; use incremental per-record
    mapping(uint256 => uint256) private _nextRequestId;
    mapping(uint256 => mapping(uint256 => AccessRequest)) public accessRequests;

    // Emergency approvals: recordId => approver => bool
    mapping(uint256 => mapping(address => bool)) private _emergencyApprovals;
    // When emergency threshold reached, store an emergency grant
    struct EmergencyGrant { address grantee; uint256 expiry; }
    mapping(uint256 => EmergencyGrant) public emergencyGrants;

    // --------------------- Events ---------------------
    event RecordRegistered(uint256 indexed recordId, address indexed owner, bytes cid, bytes32 sha256Hash);
    event AccessRequested(uint256 indexed recordId, uint256 indexed requestId, address indexed requester, string purpose);
    event AccessGranted(uint256 indexed recordId, address indexed grantee, uint256 expiry);
    event AccessRevoked(uint256 indexed recordId, address indexed grantee);
    event EmergencyApproved(uint256 indexed recordId, address indexed approver, uint256 approvals);
    event EmergencyTriggered(uint256 indexed recordId, address indexed grantee, uint256 expiry);

    // --------------------- Core Functions ---------------------
    function registerRecord(bytes calldata cid, bytes32 sha256Hash, string calldata meta, address ownerAddr) external returns (uint256) {
        // Either provider or the owner can register; if provider registers, ownerAddr must be specified
        if (!isProvider[msg.sender]) {
            // if caller not provider, treat caller as owner
            ownerAddr = msg.sender;
        } else {
            // provider must provide an owner address
            require(ownerAddr != address(0), "owner required");
        }

        uint256 id = _nextRecordId++;
        records[id] = Record({ owner: ownerAddr, cid: cid, sha256Hash: sha256Hash, createdAt: block.timestamp, meta: meta });

        emit RecordRegistered(id, ownerAddr, cid, sha256Hash);
        return id;
    }
    function requestAccess(uint256 recordId, string calldata purpose) external returns (uint256) {
        require(records[recordId].createdAt != 0, "record not found");
        uint256 reqId = ++_nextRequestId[recordId];
        accessRequests[recordId][reqId] = AccessRequest({ requester: msg.sender, requestedAt: block.timestamp, status: RequestStatus.Pending, purpose: purpose });
        emit AccessRequested(recordId, reqId, msg.sender, purpose);
        return reqId;
    }
    function grantAccess(uint256 recordId, address grantee, uint256 durationSeconds, uint256 requestId) external {
        require(records[recordId].createdAt != 0, "record not found");
        address owner = records[recordId].owner;
        require(msg.sender == owner || msg.sender == governance, "not authorized to grant");
        require(grantee != address(0), "invalid grantee");

        uint256 expiry = block.timestamp + durationSeconds;
        accessExpiry[recordId][grantee] = expiry;

        // if requestId provided, mark as granted
        if (requestId != 0) {
            AccessRequest storage ar = accessRequests[recordId][requestId];
            if (ar.requester == grantee) {
                ar.status = RequestStatus.Granted;
            }
        }

        emit AccessGranted(recordId, grantee, expiry);
    }

    function revokeAccess(uint256 recordId, address grantee) external {
        require(records[recordId].createdAt != 0, "record not found");
        address owner = records[recordId].owner;
        require(msg.sender == owner || msg.sender == governance, "not authorized to revoke");

        accessExpiry[recordId][grantee] = 0;

        uint256 maxReq = _nextRequestId[recordId];
        for (uint256 i = 1; i <= maxReq; i++) {
            AccessRequest storage ar = accessRequests[recordId][i];
            if (ar.requester == grantee && ar.status != RequestStatus.Revoked) {
                ar.status = RequestStatus.Revoked;
            }
        }

        emit AccessRevoked(recordId, grantee);
    }

    // --------------------- Emergency Access (Multisig + Time Lock) ---------------------
    function emergencyApprove(uint256 recordId, address grantee) external {
        require(_isEmergencyAdmin[msg.sender], "not emergency admin");
        require(records[recordId].createdAt != 0, "record not found");
        require(grantee != address(0), "invalid grantee");

        // prevent double counting
        if (!_emergencyApprovals[recordId][msg.sender]) {
            _emergencyApprovals[recordId][msg.sender] = true;
        }

        // count approvals
        uint256 approvals = 0;
        
        // Implement approvalCount mapping:
        approvalCount[recordId] += 1;
        approvals = approvalCount[recordId];

        emit EmergencyApproved(recordId, msg.sender, approvals);

        if (approvals >= emergencyThreshold) {
            uint256 expiry = block.timestamp + emergencyWindow;
            emergencyGrants[recordId] = EmergencyGrant({ grantee: grantee, expiry: expiry });
            // grant on-chain access window as well
            accessExpiry[recordId][grantee] = expiry;
            // reset approvals for next emergency
            approvalCount[recordId] = 0;

            emit EmergencyTriggered(recordId, grantee, expiry);
        }
    }

    // helper mapping used above
    mapping(uint256 => uint256) private approvalCount;

    // view helpers
    function hasAccess(uint256 recordId, address user) public view returns (bool) {
        uint256 expiry = accessExpiry[recordId][user];
        if (expiry == 0) return false;
        return block.timestamp <= expiry;
    }

    function isEmergencyAdmin(address admin) external view returns (bool) {
        return _isEmergencyAdmin[admin];
    }

    // small utility: owner can transfer governance
    function transferGovernance(address newGov) external onlyGovernance {
        require(newGov != address(0), "invalid");
        governance = newGov;
    }

    // For demonstration and testing: clear emergency approvals (governance)
    function clearEmergencyApprovals(uint256 recordId) external onlyGovernance {
        approvalCount[recordId] = 0;
    }

    // Fallback safe functions
    receive() external payable {
        revert("not payable");
    }
}
    // --------------------- Phase 4 : Record Retrieval ---------------------

    /**
     * @notice Retrieve record metadata using recordId (document ID)
     * @dev Read-only function for Phase 4 retrieval
     * @param recordId The document / record ID (1, 2, 3, ...)
     */
    function getRecord(uint256 recordId)
        external
        view
        returns (
            address owner,
            bytes memory cid,
            bytes32 sha256Hash,
            uint256 createdAt,
            string memory meta
        )
    {
        require(records[recordId].createdAt != 0, "record not found");

        // Only owner, governance, or approved users can retrieve
        require(
            msg.sender == records[recordId].owner ||
            msg.sender == governance ||
            hasAccess(recordId, msg.sender),
            "access denied"
        );

        Record memory r = records[recordId];
        return (r.owner, r.cid, r.sha256Hash, r.createdAt, r.meta);
    }
