import {
  CandidateVote,
  Contests,
  VotesDict,
  Ballot,
  getContests,
  validateVotes,
  Election,
  getBallotStyle,
  getPrecinctById,
} from '../election'
import { BitReader, BitWriter, CustomEncoding, Uint8Size } from '../bits'

export const MAXIMUM_WRITE_IN_LENGTH = 40

// TODO: include "magic number" and encoding version

export const WriteInEncoding = new CustomEncoding(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ \'"-.,'
)

export function encodeBallot(ballot: Ballot): Uint8Array {
  const bits = new BitWriter()
  encodeBallotInto(ballot, bits)
  return bits.toUint8Array()
}

export function encodeBallotInto(
  { election, ballotStyle, precinct, votes, ballotId }: Ballot,
  bits: BitWriter
): void {
  validateVotes({ election, ballotStyle, votes })

  const contests = getContests({ ballotStyle, election })

  bits.writeString(ballotStyle.id).writeString(precinct.id)
  encodeBallotVotesInto(contests, votes, bits)
  bits.writeString(ballotId)
}

function encodeBallotVotesInto(
  contests: Contests,
  votes: VotesDict,
  bits: BitWriter
): void {
  // write roll call
  for (const contest of contests) {
    const contestVote = votes[contest.id]
    bits.writeUint1(contestVote ? 1 : 0)
  }

  // write vote data
  for (const contest of contests) {
    const contestVote = votes[contest.id]

    if (contestVote) {
      if (contest.type === 'yesno') {
        // yesno votes get a single bit
        bits.writeBoolean(contestVote === 'yes')
      } else {
        const choices = contestVote as CandidateVote

        // candidate choices get one bit per candidate
        for (const candidate of contest.candidates) {
          bits.writeBoolean(choices.some(choice => choice.id === candidate.id))
        }

        if (contest.allowWriteIns) {
          // write write-in data
          const writeInCount = choices.reduce(
            (count, choice) => count + (choice.isWriteIn ? 1 : 0),
            0
          )
          const nonWriteInCount = choices.length - writeInCount
          const maximumWriteIns = Math.max(0, contest.seats - nonWriteInCount)

          if (maximumWriteIns > 0) {
            bits.writeUint(writeInCount, { max: maximumWriteIns })

            for (const choice of choices) {
              if (choice.isWriteIn) {
                bits.writeString(choice.name, {
                  encoding: WriteInEncoding,
                  maxLength: MAXIMUM_WRITE_IN_LENGTH,
                })
              }
            }
          }
        }
      }
    }
  }
}

export function decodeBallot(election: Election, data: Uint8Array): Ballot {
  return decodeBallotFromReader(election, new BitReader(data))
}

export function decodeBallotFromReader(
  election: Election,
  bits: BitReader
): Ballot {
  const ballotStyleId = bits.readString()
  const ballotStyle = getBallotStyle({ ballotStyleId, election })

  if (!ballotStyle) {
    throw new Error(
      `ballot style with id ${JSON.stringify(
        ballotStyleId
      )} could not be found, expected one of: ${election.ballotStyles
        .map(bs => bs.id)
        .join(', ')}`
    )
  }

  const precinctId = bits.readString()
  const precinct = getPrecinctById({ precinctId, election })

  if (!precinct) {
    throw new Error(
      `precinct with id ${JSON.stringify(
        precinctId
      )} could not be found, expected one of: ${election.precincts
        .map(p => p.id)
        .join(', ')}`
    )
  }

  const contests = getContests({ ballotStyle, election })
  const votes = decodeBallotVotes(contests, bits)
  const ballotId = bits.readString()

  readPaddingToEnd(bits)

  return {
    ballotId,
    ballotStyle,
    election,
    precinct,
    votes,
  }
}

function readPaddingToEnd(bits: BitReader): void {
  let padding = 0

  while (bits.canRead()) {
    if (bits.readUint1() !== 0) {
      throw new Error(
        'unexpected data found while reading padding, expected EOF'
      )
    }

    padding += 1
  }

  if (padding >= Uint8Size) {
    throw new Error('unexpected data found while reading padding, expected EOF')
  }
}

function decodeBallotVotes(contests: Contests, bits: BitReader): VotesDict {
  const votes: VotesDict = {}

  // read roll call
  const contestsWithAnswers = contests.filter(() => bits.readUint1())

  // read vote data
  for (const contest of contestsWithAnswers) {
    if (contest.type === 'yesno') {
      // yesno votes get a single bit
      votes[contest.id] = bits.readUint1() ? 'yes' : 'no'
    } else {
      const contestVote: CandidateVote = []

      // candidate choices get one bit per candidate
      for (const candidate of contest.candidates) {
        if (bits.readBoolean()) {
          contestVote.push(candidate)
        }
      }

      if (contest.allowWriteIns) {
        // read write-in data
        const maximumWriteIns = Math.max(0, contest.seats - contestVote.length)

        if (maximumWriteIns > 0) {
          const writeInCount = bits.readUint({ max: maximumWriteIns })

          for (let i = 0; i < writeInCount; i += 1) {
            const name = bits.readString({
              encoding: WriteInEncoding,
              maxLength: MAXIMUM_WRITE_IN_LENGTH,
            })

            contestVote.push({
              id: `write-in__${name}`,
              name,
              isWriteIn: true,
            })
          }
        }
      }

      votes[contest.id] = contestVote
    }
  }

  return votes
}