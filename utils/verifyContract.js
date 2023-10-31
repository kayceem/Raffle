const { run } = require("hardhat")

async function verify(contractAddress, args) {
    console.log("Verifying contract...")
    await run("verify:verify", {
        address: contractAddress,
        constructorArguments: args,
    })
        .then(() => {
            console.log("Contract verified!")
        })
        .catch((error) => {
            console.error(error)
        })
}
module.exports = {
    verify,
}
