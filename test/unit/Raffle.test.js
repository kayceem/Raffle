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
                      "Raffle__UpkeepNeeded",
                  )
              })
              it("updates raffle state, emits event and calls vrf coordinator", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.logs[1].args.requestId
                  assert(requestId > 0)
                  const raffleState = await raffle.getRaffleState()
                  assert.equal(raffleState.toString(), "1")
              })
          })
      })
