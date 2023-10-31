const { network, ethers } = require("hardhat")
const { verify } = require("../utils/verifyContract")
const {
    developmentChains,
    networkConfig,
    VRF_SUB_FUND_AMOUNT,
} = require("../hardhat-helper.config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts()
    const { log, deploy } = deployments
    const chainId = network.config.chainId

    const entranceFee = networkConfig[chainId].entranceFee
    const gasLane = networkConfig[chainId].gasLane
    const callbackGasLimit = networkConfig[chainId].callbackGasLimit
    const interval = networkConfig[chainId].interval
    let vrfCoordinatorV2Address, subId, vrfCoordinatorV2Mock

    if (developmentChains.includes(chainId)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        /** NOT EVENT USE LOGS */
        subId = transactionReceipt.logs[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2Address
        subId = networkConfig[chainId].subId
    }
    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subId, callbackGasLimit, interval]
    log("Deploying Raffle contract...")
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    if (developmentChains.includes(chainId)) {
        // Resolve consumer not added error
        await vrfCoordinatorV2Mock.addConsumer(subId, raffle.address)
    }
    log("Raffle contract deployed.")
    log("-------------------------------------------------------")
    log("Verifying raffle contract...")
    !developmentChains.includes(chainId) &&
        process.env.ETHERSCAN_API_KEY &&
        (await verify(raffle.address, args))
    log("Raffle contract verified.")
    log("------------------------------------------------------")
}
module.exports.tags = ["all", "raffle"]
