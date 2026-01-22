// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * Knead Rewards System
 * Manages $TOWNS token distribution for chat participation
 */
contract KneadRewards is AccessControl {
    bytes32 public constant CONTRIBUTOR_ROLE = keccak256("CONTRIBUTOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    IERC20 public immutable townsToken; // 0x00000000A22C618fd6b4D7E9A335C4B96B189a38
    
    struct UserStats {
        uint256 totalPoints;
        uint256 claimedTokens;
        uint256 lastRewardTime;
        uint8 tier; // 1-4
    }
    
    mapping(address => UserStats) public userStats;
    mapping(address => uint256) public contributorWeeklyAllowance;
    
    uint256 public constant POINTS_PER_TOKEN = 1000; // 1000 points = 1 $TOWNS
    uint256 public constant CONTRIBUTOR_THRESHOLD = 1000; // Points needed to become contributor
    
    event PointsAwarded(
        address indexed participant,
        uint256 points,
        string actionType,
        address indexed contributor
    );
    
    event RewardsClaimed(address indexed user, uint256 tokensAmount);
    event TierUpgraded(address indexed user, uint8 newTier);
    
    constructor(address _townsToken) {
        townsToken = IERC20(_townsToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * Award points to a participant (called by Contributors)
     */
    function awardPoints(
        address participant,
        uint256 points,
        string memory actionType
    ) external onlyRole(CONTRIBUTOR_ROLE) {
        require(participant != address(0), "Invalid participant");
        require(participant != msg.sender, "Cannot award yourself");
        
        UserStats storage stats = userStats[participant];
        stats.totalPoints += points;
        stats.lastRewardTime = block.timestamp;
        
        // Check for tier upgrade
        uint8 newTier = _calculateTier(stats.totalPoints);
        if (newTier > stats.tier) {
            stats.tier = newTier;
            emit TierUpgraded(participant, newTier);
        }
        
        emit PointsAwarded(participant, points, actionType, msg.sender);
    }
    
    /**
     * Claim $TOWNS tokens based on accumulated points
     */
    function claimRewards() external {
        UserStats storage stats = userStats[msg.sender];
        uint256 tokensEarned = stats.totalPoints / POINTS_PER_TOKEN;
        
        require(tokensEarned > 0, "Insufficient points");
        
        uint256 tokensToTransfer = tokensEarned * 1e18; // Convert to 18 decimals
        require(
            townsToken.transfer(msg.sender, tokensToTransfer),
            "Transfer failed"
        );
        
        stats.claimedTokens += tokensEarned;
        stats.totalPoints = stats.totalPoints % POINTS_PER_TOKEN; // Keep remainder
        
        emit RewardsClaimed(msg.sender, tokensEarned);
    }
    
    /**
     * Check if user qualifies for Contributor role
     */
    function qualifiesForContributor(address user) external view returns (bool) {
        return userStats[user].totalPoints >= CONTRIBUTOR_THRESHOLD;
    }
    
    /**
     * Calculate tier based on total points
     */
    function _calculateTier(uint256 points) internal pure returns (uint8) {
        if (points >= 1000) return 4;
        if (points >= 500) return 3;
        if (points >= 100) return 2;
        return 1;
    }
    
    /**
     * Get user's current statistics
     */
    function getUserStats(address user) external view returns (
        uint256 totalPoints,
        uint256 claimedTokens,
        uint8 tier,
        uint256 tokensAvailable
    ) {
        UserStats memory stats = userStats[user];
        return (
            stats.totalPoints,
            stats.claimedTokens,
            stats.tier,
            stats.totalPoints / POINTS_PER_TOKEN
        );
    }
    
    /**
     * Admin: Fund contract with $TOWNS
     */
    function fundTreasury(uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(
            townsToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
    }
    
    /**
     * Admin: Grant Contributor role
     */
    function grantContributorRole(address user) external onlyRole(ADMIN_ROLE) {
        _grantRole(CONTRIBUTOR_ROLE, user);
    }
}
