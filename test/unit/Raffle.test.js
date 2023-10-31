const { assert, expect } = require("chai")
const { networkConfig, developmentChains } = require("../../hardhat-helper.config")
const { deployments, getNamedAccounts, network, ethers } = require("hardhat")
const chainId = network.config.chainId

!developmentChains.includes(chainId)
    ? describe.skip
    : describe("Raffle", function () {
          let deployer, raffle, vrfCoordinatorV2Mock
          const entranceFee = networkConfig[chainId].entranceFee
          const interval = networkConfig[chainId].interval

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
          })
          describe("constructor", function () {
              it("initializes raffle correctly", async () => {
                  const r_entranceFee = await raffle.getEntranceFee()
                  assert.equal(r_entranceFee.toString(), entranceFee.toString())
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "0")
                  const r_interval = await raffle.getInterval()
                  assert.equal(r_interval.toString(), interval)
                  const requestConfirmations = await raffle.getRquestConfirmations()
                  assert.equal(requestConfirmations.toString(), "3")
              })
          })
          describe("enterRaffle", function () {
              it("reverts insufficient entrance fee", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__InsufficientEntranceFee",
                  )
              })
              it("adds a new player", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  const response = await raffle.getPlayer(0)
                  assert.equal(response, deployer)
              })
              it("adds multiple players", async () => {
                  const accounts = await ethers.getSigners()
                  for (let i = 0; i < accounts.length; i++) {
                      const raffleFromPlayer = await raffle.connect(accounts[i])
                      await raffleFromPlayer.enterRaffle({ value: entranceFee })
                  }
                  const response = await raffle.getNumberOfPlayers()
                  assert.equal(response.toString(), accounts.length.toString())
              })
              it("emits RaffleEnter on player enter", async () => {
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  )
              })
              it("revokes entrance when not open", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  // faking a chainlink keeper
                  // Got is bytes like error
                  await raffle.performUpkeep(new Uint8Array([]))
                  // Got consumer not added error
                  await expect(
                      raffle.enterRaffle({ value: entranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
              })
          })
          describe("checkUpkeep", function () {
              it("revokes if raffle has no ETH", async () => {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  // Got error, Resolve: raffle.callStatic.checkUpkeep() =>
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert(!upkeepNeeded)
              })
              it("revokes if interval has not passed", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert(!upkeepNeeded)
              })
              it("revokes if raffle is not open", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert.equal(raffleState.toString(), "1")
                  assert(!upkeepNeeded)
              })
              it("accepts after interval has passed and has balance and is open", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert(upkeepNeeded)
              })
          })
          describe("performUpkeep", function () {
              it("runs only when upKeepNeeded is true", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })
              it("revokes  when upKeepNeeded is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded",
                  )
              })
              it("updates raffle state, emits event and calls vrf coordinator", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.logs[1].args.requestId
                  assert(Number(requestId) > 0)
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "1")
              })
          })
          describe("fillRandomWords", function () {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("runs only after performUpKeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
                  ).to.be.revertedWith("nonexistent request")
              })

              /**
               *  This test simulates users entering the raffle and
                    wraps the entire functionality of the raffle
                    inside a promise that will resolve if everything is successful.
               * An event listener for the WinnerPicked is set up.
               * Mocks of chainlink keepers and vrf coordinator are used to
                    kickoff this winnerPicked event.
               * All the assertions are done once the WinnerPicked event is fired.
               */
              it("picks a winner, resets lottery ", async () => {
                  const additionalPlayers = 3
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i <= additionalPlayers; i++) {
                      const raffleFromPlayer = raffle.connect(accounts[i])
                      await raffleFromPlayer.enterRaffle({ value: entranceFee })
                  }
                  const winnerStartingBalance = await ethers.provider.getBalance(
                      accounts[1].address,
                  )
                  const startingTimeStamp = await raffle.getLatestTimseStamp()
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimseStamp()
                              const numPlayers = await raffle.getNumberOfPlayers()
                              const winnerEndingBalance = await ethers.provider.getBalance(
                                  accounts[1].address,
                              )
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (
                                      winnerStartingBalance +
                                      entranceFee +
                                      entranceFee * BigInt(additionalPlayers)
                                  ).toString(),
                              )
                          } catch (error) {
                              reject(error)
                          }
                          resolve()
                      })
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const requestId = txReceipt.logs[1].args.requestId
                      await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target)
                  })
              })
          })
      })
