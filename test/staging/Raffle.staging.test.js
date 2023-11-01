const { assert, expect } = require("chai")
const { networkConfig, developmentChains } = require("../../hardhat-helper.config")
const { deployments, getNamedAccounts, network, ethers } = require("hardhat")
const chainId = network.config.chainId

developmentChains.includes(chainId)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let deployer, raffle
          const entranceFee = networkConfig[chainId].entranceFee

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              raffle = await ethers.getContract("Raffle", deployer)
          })
          describe("fillRandomWords", function () {
              it("works with live Chainlink Keepers and VRF", async () => {
                  console.log("Setting up test...")
                  const startingTimeStamp = await raffle.getLatestTimseStamp()

                  console.log("Setting up Listener...")
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const winnerEndingBalance = await ethers.provider.getBalance(deployer)
                              console.log(`Ending balance: ${winnerEndingBalance}`)
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimseStamp()
                              const numPlayers = await raffle.getNumberOfPlayers()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(recentWinner, deployer)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (winnerStartingBalance + entranceFee).toString(),
                              )
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                          resolve()
                      })
                      console.log("Entering Raffle...")
                      await (await raffle.enterRaffle({ value: entranceFee })).wait(1)
                      console.log("Ok, time to wait...")
                      const winnerStartingBalance = await ethers.provider.getBalance(deployer)
                      console.log(`Starting balance: ${winnerStartingBalance}`)
                  })
              })
          })
      })
