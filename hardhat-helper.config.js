const { ethers } = require("hardhat")

const developmentChains = [31337]
const networkConfig = {
    31337: {
        name: "localhost",
        entranceFee: ethers.parseEther("5"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        callbackGasLimit: "500000",
        interval: "30",
    },
    11155111: {
        name: "sepolia",
        vrfCoordinatorV2Address: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        entranceFee: ethers.parseEther("0.01"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        subId: "0",
        callbackGasLimit: "500000",
        interval: "30",
    },
}
const BASE_FEE = ethers.parseEther("0.25")
const GAS_PRICE_LINK = ethers.parseEther("0.00001")
const VRF_SUB_FUND_AMOUNT = ethers.parseEther("10")

module.exports = {
    developmentChains,
    networkConfig,
    BASE_FEE,
    GAS_PRICE_LINK,
    VRF_SUB_FUND_AMOUNT,
}
