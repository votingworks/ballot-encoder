import { Command } from 'commander'
import { Election } from '../election'
import {
  generateCVR,
  trueWithPercentageProbability,
  pickAtRandom,
} from './utils'
import fs from 'fs'

const command = new Command()
command
  .version('0.1.0')
  .option('-n, --number <number>', 'Number of CVRs', '100')
  .option(
    '-O, --overvotes <percentage>',
    'Percentage of CVRs with an Overvote',
    '0'
  )
  .option(
    '-U, --undervotes <percentage>',
    'Percentage of CVRs with Undervotes (could be more than one in a ballot)',
    '0'
  )
  .option(
    '-W, --writeins <percentage>',
    'Percentage of CVRs with write-ins',
    '0'
  )
  .option(
    '-M, --multipage <percentage>',
    'Percentage of CVRs that are part of multi-page ballots',
    '0'
  )
  .parse(process.argv)

if (command.args.length != 1) {
  console.log('need exactly one election file as argument')
  process.exit(1)
}

// load election
const election: Election = JSON.parse(fs.readFileSync(command.args[0], 'utf-8'))

const opts = command.opts()

for (let i = 0; i < parseInt(opts.number); i++) {
  const ballotStyle = pickAtRandom(election.ballotStyles, 1)[0]
  const precinctId = pickAtRandom(ballotStyle.precincts, 1)[0]

  const hasOvervote = trueWithPercentageProbability(parseInt(command.overvotes))
  const hasUndervote = trueWithPercentageProbability(
    parseInt(command.undervotes)
  )
  const hasWriteins = trueWithPercentageProbability(parseInt(command.writeins))
  const fromMultipage = trueWithPercentageProbability(
    parseInt(command.multipage)
  )

  const cvr = generateCVR({
    election,
    precinctId,
    ballotStyleId: ballotStyle.id,
    hasOvervote,
    hasUndervote,
    hasWriteins,
    fromMultipage,
  })

  if (cvr) {
    console.log(JSON.stringify(cvr))
  }
}
