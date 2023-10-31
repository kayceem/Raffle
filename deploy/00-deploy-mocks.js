const { network } = require("hardhat")
const { developmentChains, BASE_FEE, GAS_PRICE_LINK } = require("../hardhat-helper.config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts()
    const { log, deploy } = deployments
    const chainId = network.config.chainId
    const args = [BASE_FEE, GAS_PRICE_LINK]
    if (developmentChains.includes(chainId)) {
        log("Deploying Mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: args,
            log: true,
            waitConfirmations: network.config.blockConfirmations || 1,
        })
        log("Mocks deployed.")
        log("-------------------------------------------------------")
    } else {
        log("Skipping Mocks.")
        log("------------------------------------------------------")
    }
}
module.exports.tags = ["all", "mocks"]
