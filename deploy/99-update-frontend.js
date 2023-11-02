const { network, ethers } = require("hardhat")
const fs = require("fs")

const isFrontEndUpdate = process.env.FRONT_END_UPDATE
const basePath = process.env.FRONT_END_BASE_PATH
const chainId = network.config.chainId

module.exports = async ({}) => {
    if (!isFrontEndUpdate) {
        return
    }
    console.log("Updating contract information for frontend...")
    const raffle = await ethers.getContract("Raffle")
    updateContractAddress(raffle)
    updateABI(raffle)
    console.log("------------------------------------------------------")
}
const updateContractAddress = async (raffle) => {
    const contractAddressFile = basePath + "/contractAddresses.json"
    const currentAddresses = JSON.parse(fs.readFileSync(contractAddressFile, "utf-8"))
    if (chainId.toString() in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.target)) {
            currentAddresses[chainId].push(raffle.target)
        }
    } else {
        currentAddresses[chainId] = [raffle.target]
    }
    console.log("Contract Address updated.")
    fs.writeFileSync(contractAddressFile, JSON.stringify(currentAddresses))
}
const updateABI = async (raffle) => {
    const abiFile = basePath + "/abi.json"
    fs.writeFileSync(abiFile, raffle.interface.formatJson())
    console.log("Contract ABI updated.")
}
module.exports.tags = ["all", "frontend"]
