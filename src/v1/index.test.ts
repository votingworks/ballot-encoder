import { BitWriter } from '../bits'
import electionWithMsEitherNeitherUntyped from '../data/electionWithMsEitherNeither.json'
import {
  BallotType,
  BallotTypeMaximumValue,
  Candidate,
  Election,
  electionSampleLongContent as election,
  getContests,
  isVotePresent,
  Vote,
  vote,
  CompletedBallot,
} from '../election'
import * as v0 from '../v0'
import {
  decodeBallot,
  decodeHMPBBallotPageMetadata,
  detect,
  encodeBallot,
  encodeBallotInto,
  encodeHMPBBallotPageMetadata,
  HMPBBallotPageMetadata,
  MAXIMUM_WRITE_IN_LENGTH,
  Prelude,
  WriteInEncoding,
  decodeHMPBBallotPageMetadataCheckData,
} from './index'

const electionWithMsEitherNeither = (electionWithMsEitherNeitherUntyped as unknown) as Election

function falses(count: number): boolean[] {
  return new Array(count).fill(false)
}

test('can detect an encoded v1 buffer', () => {
  expect(detect(Uint8Array.of(...Prelude))).toBe(true)
  expect(detect(Uint8Array.of())).toBe(false)
  expect(detect(Uint8Array.of(0, ...Prelude))).toBe(false)
  expect(detect(Uint8Array.of(...Prelude.slice(0, -2)))).toBe(false)
})

test('does not detect a v0 buffer as v1', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ election, ballotStyle })
  const votes = vote(contests, {})
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }

  expect(detect(v0.encodeBallot(election, ballot))).toBe(false)
})

test('encodes & decodes with Uint8Array as the standard encoding interface', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ election, ballotStyle })
  const votes = vote(contests, {})
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }

  expect(decodeBallot(election, encodeBallot(election, ballot))).toEqual(ballot)
})

it('encodes & decodes empty votes correctly', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ ballotStyle, election })
  const votes = vote(contests, {})
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('12')
    // precinct id
    .writeString('23')
    // ballot Id
    .writeString('abcde')
    // vote roll call only, no vote data
    .writeBoolean(...contests.map(() => false))
    // test ballot?
    .writeBoolean(false)
    // ballot type
    .writeUint(BallotType.Standard, { max: BallotTypeMaximumValue })
    .toUint8Array()

  expect(encodeBallot(election, ballot)).toEqualBits(encodedBallot)
  expect(decodeBallot(election, encodedBallot)).toEqual(ballot)
})

it('encodes & decodes whether it is a test ballot', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ ballotStyle, election })
  const votes = vote(contests, {})
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: true,
    ballotType: BallotType.Standard,
  }
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('12')
    // precinct id
    .writeString('23')
    // ballot Id
    .writeString('abcde')
    // vote roll call only, no vote data
    .writeBoolean(...contests.map(() => false))
    // test ballot?
    .writeBoolean(true)
    // ballot type
    .writeUint(BallotType.Standard, { max: BallotTypeMaximumValue })
    .toUint8Array()

  expect(encodeBallot(election, ballot)).toEqualBits(encodedBallot)
  expect(decodeBallot(election, encodedBallot)).toEqual(ballot)
})

it('encodes & decodes the ballot type', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ ballotStyle, election })
  const votes = vote(contests, {})
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: true,
    ballotType: BallotType.Absentee,
  }
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('12')
    // precinct id
    .writeString('23')
    // ballot Id
    .writeString('abcde')
    // vote roll call only, no vote data
    .writeBoolean(...contests.map(() => false))
    // test ballot?
    .writeBoolean(true)
    // ballot type
    .writeUint(BallotType.Absentee, { max: BallotTypeMaximumValue })
    .toUint8Array()

  expect(encodeBallot(election, ballot)).toEqualBits(encodedBallot)
  expect(decodeBallot(election, encodedBallot)).toEqual(ballot)
})

it('encodes & decodes yesno votes correctly', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const ballotId = 'abcde'
  const contests = getContests({ ballotStyle, election })
  const votes = vote(contests, {
    'judicial-robert-demergue': ['yes'],
    'judicial-elmer-hull': ['yes'],
    'question-a': ['yes'],
    'question-b': ['no'],
    'question-c': ['yes'],
    'proposition-1': [],
    'measure-101': ['no'],
    '102': ['yes'],
  })
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('12')
    // precinct id
    .writeString('23')
    // ballot Id
    .writeString('abcde')
    // vote roll call
    .writeBoolean(
      ...contests.map((contest) => isVotePresent(votes[contest.id]))
    )
    // vote data
    .writeBoolean(true)
    .writeBoolean(true)
    .writeBoolean(true)
    .writeBoolean(false)
    .writeBoolean(true)
    .writeBoolean(false)
    .writeBoolean(true)
    // test ballot?
    .writeBoolean(false)
    // ballot type
    .writeUint(BallotType.Standard, { max: BallotTypeMaximumValue })
    .toUint8Array()

  expect(encodeBallot(election, ballot)).toEqualBits(encodedBallot)
  expect(encodeBallot(election, decodeBallot(election, encodedBallot))).toEqual(
    encodedBallot
  )
})

it('encodes & decodes ms-either-neither votes correctly', () => {
  const election = electionWithMsEitherNeither
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts.filter(
    (p) => p.id === ballotStyle.precincts[0]
  )[0]
  const ballotId = 'abcde'
  const contests = getContests({ ballotStyle, election })
  const votePermutations: {
    [key: string]: Vote | string | string[] | Candidate
  }[] = [
    { '750000015': ['yes'], '750000016': ['no'] },
    { '750000015': ['yes'], '750000016': ['yes'] },
    { '750000015': ['no'], '750000016': ['no'] },
    { '750000015': ['no'], '750000016': ['yes'] },
    { '750000016': ['yes'] },
    { '750000015': ['no'] },
    {},
  ]

  for (const rawVote of votePermutations) {
    const votes = vote(contests, rawVote)
    const ballot: CompletedBallot = {
      ballotId,
      ballotStyle,
      precinct,
      votes,
      isTestMode: false,
      ballotType: BallotType.Standard,
    }
    const encodedBallotWriter = new BitWriter()
      // prelude + version number
      .writeString('VX', { includeLength: false })
      .writeUint8(1)
      // ballot style id
      .writeString('4')
      // precinct id
      .writeString('6538')
      // ballot Id
      .writeString('abcde')
    // vote roll call
    for (const contest of contests) {
      if (contest.id === '750000015-either-neither') {
        encodedBallotWriter.writeBoolean('750000015' in rawVote)
        encodedBallotWriter.writeBoolean('750000016' in rawVote)
      } else {
        encodedBallotWriter.writeBoolean(isVotePresent(votes[contest.id]))
      }
    }
    // vote data
    if (Array.isArray(rawVote['750000015'])) {
      encodedBallotWriter.writeBoolean(rawVote['750000015'][0] === 'yes')
    }
    if (Array.isArray(rawVote['750000016'])) {
      encodedBallotWriter.writeBoolean(rawVote['750000016'][0] === 'yes')
    }

    const encodedBallot = encodedBallotWriter
      // test ballot?
      .writeBoolean(false)
      // ballot type
      .writeUint(BallotType.Standard, { max: BallotTypeMaximumValue })
      .toUint8Array()

    expect(encodeBallot(election, ballot)).toEqualBits(encodedBallot)
    expect(
      encodeBallot(election, decodeBallot(election, encodedBallot))
    ).toEqual(encodedBallot)
  }
})

it('throws on trying to encode a bad yes/no vote', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const ballotId = 'abcde'
  const contests = getContests({ ballotStyle, election })
  const votes = vote(contests, {
    'judicial-robert-demergue': 'yes',
  })
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }

  expect(() => encodeBallot(election, ballot)).toThrowError(
    'cannot encode a non-array yes/no vote: "yes"'
  )

  // overvotes fail too.
  ballot.votes['judicial-robert-demergue'] = ['yes', 'no']
  expect(() => encodeBallot(election, ballot)).toThrowError(
    'cannot encode a yes/no overvote: ["yes","no"]'
  )
})

it('encodes & decodes candidate choice votes correctly', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const ballotId = 'abcde'
  const contests = getContests({ ballotStyle, election })
  const votes = vote(contests, {
    president: 'barchi-hallaren',
    senator: 'weiford',
    'representative-district-6': 'plunkard',
    governor: 'franz',
    'lieutenant-governor': 'norberg',
    'secretary-of-state': 'shamsi',
    'state-senator-district-31': 'shiplett',
    'state-assembly-district-54': 'solis',
    'county-commissioners': 'argent',
    'county-registrar-of-wills': 'ramachandrani',
    'city-mayor': 'white',
    'city-council': 'eagle',
  })
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('12')
    // precinct id
    .writeString('23')
    // ballot Id
    .writeString('abcde')
    // vote roll call
    .writeBoolean(...contests.map((contest) => contest.id in votes))
    // vote data
    // - president (barchi-hallaren)
    .writeBoolean(true, ...falses(5))
    // - senator (weiford)
    .writeBoolean(true, ...falses(6))
    // - representative-district-6 (plunarkd)
    .writeBoolean(true, ...falses(4))
    // - governor (franz)
    .writeBoolean(true, ...falses(25))
    // - lieutenant-governor (norberg)
    .writeBoolean(true, ...falses(8))
    // - secretary-of-state (shamsi)
    .writeBoolean(true, false)
    // - state-senator-district-31 (shiplet)
    .writeBoolean(true)
    // - state-assembly-district-54 (solis)
    .writeBoolean(true, false, false)
    // - county-commissioners (argent)
    .writeBoolean(true, ...falses(14))
    // --- write-ins
    .writeUint(0, { max: 3 }) // 4 seats - 1 selection = 3 write-ins max
    // - county-registrar-of-wills (ramachandrani)
    .writeBoolean(true)
    // - city-mayor (white)
    .writeBoolean(true, false)
    // - city-council (eagle)
    .writeBoolean(true, ...falses(5))
    // --- write-ins
    .writeUint(0, { max: 2 }) // 3 seats - 1 selection = 2 write-ins max
    // test ballot?
    .writeBoolean(false)
    // ballot type
    .writeUint(BallotType.Standard, { max: BallotTypeMaximumValue })
    .toUint8Array()

  expect(encodeBallot(election, ballot)).toEqualBits(encodedBallot)
  expect(decodeBallot(election, encodedBallot)).toEqual(ballot)
})

it('encodes & decodes write-in votes correctly', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ ballotStyle, election })
  const votes = vote(contests, {
    'county-registrar-of-wills': [
      { id: 'write-in__MICKEY MOUSE', name: 'MICKEY MOUSE', isWriteIn: true },
    ],
  })
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('12')
    // precinct id
    .writeString('23')
    // ballot Id
    .writeString('abcde')
    // vote roll call
    .writeBoolean(...contests.map((contest) => contest.id in votes))
    // vote data
    // - county-registrar-of-wills (ramachandrani)
    .writeBoolean(false)
    // --- write-ins
    .writeUint(1, { max: 1 }) // 1 seat - 0 selections = 1 max write-in
    .writeString('MICKEY MOUSE', {
      encoding: WriteInEncoding,
      maxLength: MAXIMUM_WRITE_IN_LENGTH,
    })
    // test ballot?
    .writeBoolean(false)
    // ballot type
    .writeUint(BallotType.Standard, { max: BallotTypeMaximumValue })
    .toUint8Array()

  expect(encodeBallot(election, ballot)).toEqualBits(encodedBallot)
  expect(decodeBallot(election, encodedBallot)).toEqual(ballot)
})

test('cannot decode a ballot without the prelude', () => {
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('XV', { includeLength: false })
    .writeUint8(1)
    .toUint8Array()

  expect(() => decodeBallot(election, encodedBallot)).toThrowError(
    "expected leading prelude 'V' 'X' 0b00000001 but it was not found"
  )
})

test('cannot decode a ballot with a ballot style ID not in the election', () => {
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('ZZZ')
    // precinct id
    .writeString('23')
    // ballot Id
    .writeString('abcde')
    .toUint8Array()

  expect(() => decodeBallot(election, encodedBallot)).toThrowError(
    'ballot style with id "ZZZ" could not be found, expected one of: 12, 5, 7C'
  )
})

test('cannot decode a ballot with a precinct ID not in the election', () => {
  const encodedBallot = new BitWriter()
    // prelude + version number
    .writeString('VX', { includeLength: false })
    .writeUint8(1)
    // ballot style id
    .writeString('12')
    // precinct id
    .writeString('ZZZ')
    // ballot Id
    .writeString('abcde')
    .toUint8Array()

  expect(() => decodeBallot(election, encodedBallot)).toThrowError(
    'precinct with id "ZZZ" could not be found, expected one of: 23, 21, 20'
  )
})

test('cannot decode a ballot that includes extra data at the end', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ election, ballotStyle })
  const votes = vote(contests, {})
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }

  const writer = new BitWriter()

  encodeBallotInto(election, ballot, writer)

  const corruptedBallot = writer.writeBoolean(true).toUint8Array()

  expect(() => decodeBallot(election, corruptedBallot)).toThrowError(
    'unexpected data found while reading padding, expected EOF'
  )
})

test('cannot decode a ballot that includes too much padding at the end', () => {
  const ballotStyle = election.ballotStyles[0]
  const precinct = election.precincts[0]
  const contests = getContests({ election, ballotStyle })
  const votes = vote(contests, {})
  const ballotId = 'abcde'
  const ballot: CompletedBallot = {
    ballotId,
    ballotStyle,
    precinct,
    votes,
    isTestMode: false,
    ballotType: BallotType.Standard,
  }

  const writer = new BitWriter()

  encodeBallotInto(election, ballot, writer)

  const corruptedBallot = writer.writeUint8(0).toUint8Array()

  expect(() => decodeBallot(election, corruptedBallot)).toThrowError(
    'unexpected data found while reading padding, expected EOF'
  )
})

test('encode and decode HMPB ballot page metadata', () => {
  const electionHash = 'abc345624cdeff278def'
  const ballotMetadata: HMPBBallotPageMetadata = {
    electionHash,
    precinctId: election.ballotStyles[0].precincts[0],
    ballotStyleId: election.ballotStyles[0].id,
    locales: {
      primary: 'en-US',
    },
    pageNumber: 3,
    isTestMode: true,
    ballotType: BallotType.Standard,
  }

  const encoded = encodeHMPBBallotPageMetadata(election, ballotMetadata)

  expect(encoded).toEqual(
    Uint8Array.of(
      86,
      80,
      1,
      20,
      171,
      195,
      69,
      98,
      76,
      222,
      255,
      39,
      141,
      239,
      3,
      3,
      22,
      0,
      0,
      224
    )
  )
  const decoded = decodeHMPBBallotPageMetadata(election, encoded)
  expect(decoded).toEqual(ballotMetadata)

  // corrupt the first byte and expect it to fail
  encoded[0] = 42
  expect(() => decodeHMPBBallotPageMetadata(election, encoded)).toThrowError()
})

test('encode and decode HMPB ballot page metadata with ballot ID', () => {
  const election = electionWithMsEitherNeither
  const electionHash = 'abc345624cdeff278def'
  const ballotMetadata: HMPBBallotPageMetadata = {
    electionHash,
    precinctId: election.ballotStyles[2].precincts[1],
    ballotStyleId: election.ballotStyles[2].id,
    locales: {
      primary: 'en-US',
      secondary: 'es-US',
    },
    pageNumber: 2,
    isTestMode: false,
    ballotType: BallotType.Absentee,
    ballotId: 'foobar',
  }

  const encoded = encodeHMPBBallotPageMetadata(election, ballotMetadata)

  expect(encoded).toEqual(
    Uint8Array.of(
      86,
      80,
      1,
      20,
      171,
      195,
      69,
      98,
      76,
      222,
      255,
      39,
      141,
      239,
      13,
      5,
      13,
      116,
      1,
      1,
      16,
      96,
      204,
      205,
      237,
      236,
      76,
      46,
      64
    )
  )

  const decoded = decodeHMPBBallotPageMetadata(election, encoded)
  expect(decoded).toEqual(ballotMetadata)
})

test('encode HMPB ballot page metadata with bad precinct fails', () => {
  const electionHash = 'abc345624cdeff278def'
  const ballotMetadata: HMPBBallotPageMetadata = {
    electionHash,
    precinctId: 'SanDimas', // not an actual precinct ID
    ballotStyleId: election.ballotStyles[0].id,
    locales: {
      primary: 'en-US',
    },
    pageNumber: 3,
    isTestMode: true,
    ballotType: BallotType.Standard,
  }

  expect(() =>
    encodeHMPBBallotPageMetadata(election, ballotMetadata)
  ).toThrowError('precinct ID not found: SanDimas')
})

test('encode HMPB ballot page metadata with bad ballot style fails', () => {
  const electionHash = 'abc345624cdeff278def'
  const ballotMetadata: HMPBBallotPageMetadata = {
    electionHash,
    precinctId: election.ballotStyles[0].precincts[0],
    ballotStyleId: '42', // not a good ballot style
    locales: {
      primary: 'en-US',
    },
    pageNumber: 3,
    isTestMode: true,
    ballotType: BallotType.Standard,
  }

  expect(() =>
    encodeHMPBBallotPageMetadata(election, ballotMetadata)
  ).toThrowError('ballot style ID not found: 42')
})

test('encode HMPB ballot page metadata with bad primary locale', () => {
  const electionHash = 'abc345624cdeff278def'
  const ballotMetadata: HMPBBallotPageMetadata = {
    electionHash,
    precinctId: election.ballotStyles[0].precincts[0],
    ballotStyleId: election.ballotStyles[0].id,
    locales: {
      primary: 'fr-CA', // not a supported locale
    },
    pageNumber: 3,
    isTestMode: true,
    ballotType: BallotType.Standard,
  }

  expect(() =>
    encodeHMPBBallotPageMetadata(election, ballotMetadata)
  ).toThrowError('primary locale not found: fr-CA')
})

test('encode HMPB ballot page metadata with bad secondary locale', () => {
  const electionHash = 'abc345624cdeff278def'
  const ballotMetadata: HMPBBallotPageMetadata = {
    electionHash,
    precinctId: election.ballotStyles[0].precincts[0],
    ballotStyleId: election.ballotStyles[0].id,
    locales: {
      primary: 'en-US',
      secondary: 'fr-CA', // not a supported locale
    },
    pageNumber: 3,
    isTestMode: true,
    ballotType: BallotType.Standard,
  }

  expect(() =>
    encodeHMPBBallotPageMetadata(election, ballotMetadata)
  ).toThrowError('secondary locale not found: fr-CA')
})

test('decode HMPB ballot page metadata check data separately', () => {
  const electionHash = 'abc345624cdeff278def'
  const ballotMetadata: HMPBBallotPageMetadata = {
    electionHash,
    precinctId: election.ballotStyles[0].precincts[0],
    ballotStyleId: election.ballotStyles[0].id,
    locales: {
      primary: 'en-US',
    },
    pageNumber: 3,
    isTestMode: true,
    ballotType: BallotType.Standard,
  }

  const encoded = encodeHMPBBallotPageMetadata(election, ballotMetadata)
  expect(decodeHMPBBallotPageMetadataCheckData(encoded)).toEqual({
    electionHash,
    precinctCount: election.precincts.length,
    ballotStyleCount: election.ballotStyles.length,
    contestCount: election.contests.length,
  })
})
