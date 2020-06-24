/* eslint-disable @typescript-eslint/ban-types */
import electionSampleUntyped from './data/electionSample.json'
import electionSampleLongContentUntyped from './data/electionSampleLongContent.json'

// Generic
export type VoidFunction = () => void
export interface Dictionary<T> {
  [key: string]: Optional<T>
}
export type Optional<T> = T | undefined

export type LocaleMap<T extends object, K extends keyof T = keyof T> = {
  [key: string]: { [P in K]?: T[P] } | undefined
}

export type Localize<T extends object, K extends keyof T> = {
  _lang?: LocaleMap<T, K>
} & {
  [P in keyof T]: T[P] extends (infer E)[]
    ? Localized<E>[]
    : T[P] extends object
    ? Localized<T[P]>
    : T[P]
}

// Candidates
export interface Candidate {
  readonly id: string
  readonly name: string
  readonly partyId?: string
  isWriteIn?: boolean
}
export type OptionalCandidate = Optional<Candidate>

// Contests
export type ContestTypes = 'candidate' | 'yesno'
export interface Contest {
  readonly id: string
  readonly districtId: string
  readonly partyId?: string
  readonly section: string
  readonly title: string
  readonly type: ContestTypes
}
export interface CandidateContest extends Contest {
  readonly type: 'candidate'
  readonly seats: number
  readonly candidates: Candidate[]
  readonly allowWriteIns: boolean
}
export interface YesNoContest extends Contest {
  readonly type: 'yesno'
  readonly description: string
  readonly shortTitle: string
}
export type Contests = (CandidateContest | YesNoContest)[]

// Election
export interface BallotStyle {
  readonly id: string
  readonly precincts: string[]
  readonly districts: string[]
  readonly partyId?: string
}
export interface Party {
  readonly id: string
  readonly name: string
  readonly fullName: string
  readonly abbrev: string
}
export type Parties = Party[]
export interface Precinct {
  readonly id: string
  readonly name: string
}
export interface District {
  readonly id: string
  readonly name: string
}
export interface County {
  readonly id: string
  readonly name: string
}

export interface Election {
  readonly ballotStyles: BallotStyle[]
  readonly county: County
  readonly parties: Parties
  readonly precincts: Precinct[]
  readonly districts: District[]
  readonly contests: Contests
  readonly date: string
  readonly seal?: string
  readonly sealURL?: string
  readonly ballotStrings?: Dictionary<string>
  readonly state: string
  readonly title: string
}
export type OptionalElection = Optional<Election>

type Localized<T> = T extends Election
  ? Localize<
      Election,
      | 'date'
      | 'seal'
      | 'sealURL'
      | 'state'
      | 'title'
      | 'districts'
      | 'ballotStrings'
    >
  : T extends BallotStyle
  ? Localize<T, 'precincts' | 'districts'>
  : T extends Precinct
  ? Localize<T, 'name'>
  : T extends District
  ? Localize<T, 'name'>
  : T

export type LocalizedElection = Localized<Election>

export type LocalizedBallotStyles = {
  readonly precincts: Localized<Precinct>[]
  readonly districts: string[]
}

// Votes
export type CandidateVote = Candidate[]
export type YesNoVote = 'yes' | 'no'
export type OptionalYesNoVote = Optional<YesNoVote>
export type Vote = CandidateVote | YesNoVote
export type OptionalVote = Optional<Vote>
export type VotesDict = Dictionary<Vote>

export enum BallotType {
  Standard = 0,
  Absentee = 1,
  Provisional = 2,
}

// Updating this value is a breaking change.
export const BallotTypeMaximumValue = (1 << 4) - 1

export interface CompletedBallot {
  election: Election
  ballotStyle: BallotStyle
  precinct: Precinct
  ballotId: string
  votes: VotesDict
  isTestBallot: boolean
  ballotType: BallotType
}

// Smart Card Content
export type CardDataTypes = 'voter' | 'pollworker' | 'clerk'
export interface CardData {
  readonly t: CardDataTypes
}
export interface VoterCardData extends CardData {
  readonly t: 'voter'
  readonly c: number // created date
  readonly bs: string // ballot style id
  readonly pr: string // precinct id
  readonly uz?: number // used (voided)
  readonly bp?: number // ballot printed date
  readonly v?: VotesDict // votes object
  readonly u?: number // updated date
  readonly m?: string // mark machine id
}
export interface PollworkerCardData extends CardData {
  readonly t: 'pollworker'
  readonly h: string
}
export interface ClerkCardData extends CardData {
  readonly t: 'clerk'
  readonly h: string
}

/**
 * Gets contests which belong to a ballot style in an election.
 */
export const getContests = ({
  ballotStyle,
  election,
}: {
  ballotStyle: BallotStyle
  election: Election
}): Contests =>
  election.contests.filter(
    (c) =>
      ballotStyle.districts.includes(c.districtId) &&
      ballotStyle.partyId === c.partyId
  )

/**
 * Retrieves a precinct by id.
 */
export const getPrecinctById = ({
  election,
  precinctId,
}: {
  election: Election
  precinctId: string
}): Precinct | undefined => election.precincts.find((p) => p.id === precinctId)

/**
 * Retrieves a ballot style by id.
 */
export const getBallotStyle = ({
  ballotStyleId,
  election,
}: {
  ballotStyleId: string
  election: Election
}): BallotStyle | undefined =>
  election.ballotStyles.find((bs) => bs.id === ballotStyleId)

/**
 * Validates the votes for a given ballot style in a given election.
 *
 * @throws When an inconsistency is found.
 */
export const validateVotes = ({
  votes,
  ballotStyle,
  election,
}: {
  votes: VotesDict
  ballotStyle: BallotStyle
  election: Election
}): void => {
  const contests = getContests({ election, ballotStyle })

  for (const contestId of Object.getOwnPropertyNames(votes)) {
    const contest = contests.find((c) => c.id === contestId)

    if (!contest) {
      throw new Error(
        `found a vote with contest id ${JSON.stringify(
          contestId
        )}, but no such contest exists in ballot style ${
          ballotStyle.id
        } (expected one of ${contests.map((c) => c.id).join(', ')})`
      )
    }
  }
}

export const electionSample = (electionSampleUntyped as unknown) as LocalizedElection
export const electionSampleLongContent = (electionSampleLongContentUntyped as unknown) as LocalizedElection

/**
 * @deprecated Does not support i18n. 'party.fullname` should be used instead.
 * Gets the adjective used to describe the political party for a primary
 * election, e.g. "Republican" or "Democratic".
 */
export const getPartyPrimaryAdjectiveFromBallotStyle = ({
  ballotStyleId,
  election,
}: {
  ballotStyleId: string
  election: Election
}): string => {
  const parts = ballotStyleId && ballotStyleId.match(/(\d+)(\w+)/i)
  const abbrev = parts && parts[2]
  const party = abbrev && election.parties.find((p) => p.abbrev === abbrev)
  const name = party && party.name
  return (name === 'Democrat' && 'Democratic') || name || ''
}

/**
 * Gets the full name of the political party for a primary election,
 * e.g. "Republican Party" or "Democratic Party".
 */
export const getPartyFullNameFromBallotStyle = ({
  ballotStyleId,
  election,
}: {
  ballotStyleId: string
  election: Election
}): string => {
  const ballotStyle = getBallotStyle({ ballotStyleId, election })
  const party = election.parties.find((p) => p.id === ballotStyle?.partyId)
  return party?.fullName ?? ''
}

/**
 * Helper function to build a `VotesDict` more easily, primarily for testing.
 *
 * @param contests The contests the voter voted in, probably from `getContests`.
 * @param shorthand A mapping of contest id to "vote", where a vote can be a
 * `Vote`, the string id of a candidate, multiple string ids for candidates, or
 * just a `Candidate` by itself.
 *
 * @example
 *
 * // Vote by candidate id.
 * vote(contests, { president: 'boone-lian' })
 *
 * // Vote by yesno contest.
 * vote(contests, { 'question-a': 'yes' })
 *
 * // Multiple votes.
 * vote(contests, {
 *   president: 'boone-lian',
 *   'question-a': 'yes'
 * })
 *
 * // Multiple candidate selections.
 * vote(contests, {
 *   'city-council': ['rupp', 'davis']
 * })
 */
export function vote(
  contests: Contests,
  shorthand: {
    [key: string]: Vote | string | string[] | Candidate
  }
): VotesDict {
  return Object.getOwnPropertyNames(shorthand).reduce((result, contestId) => {
    const contest = contests.find((c) => c.id === contestId)

    if (!contest) {
      throw new Error(`unknown contest ${contestId}`)
    }

    const choice = shorthand[contestId]

    if (contest.type === 'yesno') {
      return { ...result, [contestId]: choice }
    }

    if (Array.isArray(choice) && typeof choice[0] === 'string') {
      return {
        ...result,
        [contestId]: contest.candidates.filter((c) =>
          (choice as string[]).includes(c.id)
        ),
      }
    }

    if (typeof choice === 'string') {
      return {
        ...result,
        [contestId]: [contest.candidates.find((c) => c.id === choice)],
      }
    }

    return {
      ...result,
      [contestId]: Array.isArray(choice) ? choice : [choice],
    }
  }, {})
}

/**
 * Copies an election definition preferring strings from the matching locale.
 */
export function withLocale(election: Election, locale: string): Election {
  return copyWithLocale(election, locale)
}

function copyWithLocale<T>(value: T, locale: string): T
function copyWithLocale<T>(value: T[], locale: string): T[]
function copyWithLocale<T>(value: T, locale: string): T {
  if (Array.isArray(value)) {
    return (value.map((element) =>
      copyWithLocale(element, locale)
    ) as unknown) as T
  }

  if (typeof value === 'undefined') {
    return value
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const lang =
      '_lang' in record && (record._lang as LocaleMap<Record<string, unknown>>)

    if (!lang) {
      return value
    }

    const stringsEntry = Object.entries(lang).find(
      ([key]) => key.toLowerCase() === locale.toLowerCase()
    )

    if (!stringsEntry || !stringsEntry[1]) {
      return value
    }

    const strings = stringsEntry[1]
    const result: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(record)) {
      if (key === '_lang') {
        continue
      }

      if (key in strings) {
        result[key] = strings[key]
      } else {
        result[key] = copyWithLocale(val, locale)
      }
    }

    return result as T
  }

  return value
}
