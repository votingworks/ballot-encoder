import {
  BallotType,
  CandidateContest,
  Election,
  getContests,
  getBallotStyle,
  getPrecinctById,
  Dictionary,
} from '../election'

import { randomBase64 } from '../utils/random'

export interface CastVoteRecordLocale {
  primary: string
  secondary?: string
}

export interface CastVoteRecord
  extends Dictionary<
    string | string[] | boolean | number | CastVoteRecordLocale
  > {
  _precinctId: string
  _ballotStyleId: string
  _ballotId: string
  _testBallot: boolean
  _scannerId: string
  _pageNumber?: number
  _locale?: CastVoteRecordLocale
}

interface objectWithSortkey<T> {
  option: T
  sortkey: number
}

export function trueWithPercentageProbability(percentage: number): boolean {
  return Math.random() < percentage / 100
}

export function randomIntegerLessThan(max: number): number {
  return Math.floor(Math.random() * max)
}

export function pickAtRandom<T>(options: T[], num: number): T[] {
  if (num === 0) {
    return []
  }

  const optionsWithRandomness = options.map((o) => {
    return { option: o, sortkey: Math.random() } as objectWithSortkey<T>
  })
  optionsWithRandomness.sort((first, second) =>
    first.sortkey < second.sortkey ? -1 : 1
  )
  return optionsWithRandomness.map((or) => or.option).slice(0, num)
}

interface GenerateCVRParams {
  election: Election
  precinctId: string
  ballotStyleId: string
  hasOvervote?: boolean
  hasUndervote?: boolean
  hasWriteins?: boolean
  fromMultipage?: boolean
  isTestBallot?: boolean
  ballotType?: BallotType
}

export const generateCVR = ({
  election,
  precinctId,
  ballotStyleId,
  isTestBallot = true,
  hasOvervote = false,
  hasUndervote = false,
  hasWriteins = false,
  fromMultipage = false,
}: // TODO: include ballot type?
GenerateCVRParams): CastVoteRecord | undefined => {
  const ballotStyle = getBallotStyle({ election, ballotStyleId })
  const precinct = getPrecinctById({ election, precinctId })

  if (!ballotStyle || !precinct) {
    return
  }

  const votes: Dictionary<string[]> = {}

  // get all the contests
  const contests = getContests({ ballotStyle, election })

  if (contests.length === 0) return

  const overvoteContestId = hasOvervote
    ? pickAtRandom(contests, 1)[0].id
    : undefined

  // let's not do too many undervotes, 1/3 at most
  const numUndervotes = hasUndervote
    ? randomIntegerLessThan(contests.length / 3)
    : 0
  const undervoteContestIds = hasUndervote
    ? pickAtRandom(contests, numUndervotes).map((c) => c.id)
    : []

  // let's do even fewer write-ins, 1/5 at most
  const contestsWithWriteins = contests.filter(
    (c) => c.type === 'candidate' && (c as CandidateContest).allowWriteIns
  )
  const numWriteins = hasWriteins
    ? randomIntegerLessThan(contestsWithWriteins.length / 5)
    : 0
  const writeinContestIds = hasWriteins
    ? pickAtRandom(contestsWithWriteins, numWriteins).map((c) => c.id)
    : []

  // if multipage, pick a page
  const contestsPerPage = 10
  let pageNumber
  if (fromMultipage) {
    const numPages = Math.ceil(contests.length / contestsPerPage)
    pageNumber = randomIntegerLessThan(numPages) + 1
  }

  const filteredContests = pageNumber
    ? contests.slice(
        contestsPerPage * (pageNumber - 1),
        contestsPerPage * pageNumber
      )
    : contests

  filteredContests.forEach((contest) => {
    // overvote takes precedence on undervote
    const contestIsOvervote = overvoteContestId === contest.id
    const contestIsUndervote =
      !contestIsOvervote && undervoteContestIds.includes(contest.id)

    const contestHasWritein = writeinContestIds.includes(contest.id)

    let options: string[]
    let seats: number
    switch (contest.type) {
      case 'candidate':
        options = (contest as CandidateContest).candidates.map((c) => c.id)
        seats = (contest as CandidateContest).seats

        // add the write-in options, three times as many as there are seats to cause lots of write-ins
        if (contestHasWritein) {
          for (let i = 0; i < seats * 3; i++) {
            options.push('__write-in')
          }
        }

        break
      case 'yesno':
        options = ['yes', 'no']
        seats = 1
        break
    }

    const numFilledIn = contestIsUndervote
      ? randomIntegerLessThan(seats)
      : contestIsOvervote
      ? seats + randomIntegerLessThan(seats + 2)
      : seats
    votes[contest.id] = pickAtRandom(options, numFilledIn)
  })

  // scanner ID from 1 to 10
  const scannerNumber = Math.ceil(Math.random() * 10)
  const scannerId = `scanner-${scannerNumber}`

  return {
    _precinctId: precinctId,
    _ballotStyleId: ballotStyleId,
    _ballotId: randomBase64(),
    _testBallot: isTestBallot,
    _scannerId: scannerId,
    _pageNumber: pageNumber,
    _locale: {
      primary: 'en-US',
    },
    ...votes,
  }
}
