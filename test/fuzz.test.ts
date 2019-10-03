/**
 * This test file is a bit different from the others. It does fuzz testing of
 * `BitReader` and `BitWriter` by ensuring that a random sequence of
 * corresponding write and read actions yields the appropriate values.
 */

/* eslint-disable no-bitwise, @typescript-eslint/no-explicit-any */

import { Random } from 'random-js'
import { inspect } from 'util'
import {
  BitReader,
  BitWriter,
  CustomEncoding,
  Uint8Index,
  Uint8Size,
} from '../src/bits'

type Instance = InstanceType<new (...args: any) => any>

interface Action<C extends Instance, M extends keyof C = keyof C> {
  method: M
  args: Parameters<C[M]>
  returnValue?: ReturnType<C[M]>
}

interface PerformedAction<C extends Instance, M extends keyof C = keyof C>
  extends Action<C, M> {
  receiver: C
}

const random = new Random()

type ActionsPairs = [Action<BitWriter>[], Action<BitReader>[]]

const testCaseFactories = {
  'vararg booleans': (): ActionsPairs => {
    const argCount = random.integer(0, 10)
    const args = new Array<boolean>(argCount)
      .fill(false)
      .map(() => random.bool())

    return [
      [{ method: 'writeBoolean', args }],
      args.map(arg => ({
        method: 'readBoolean',
        args: [],
        returnValue: arg,
      })),
    ]
  },

  'length-prefixed utf-8 strings': (): ActionsPairs => {
    const length = random.integer(0, 50)
    const maxLength = random.integer(length, length * 2)
    const string = random.string(length)

    return [
      [{ method: 'writeString', args: [string, { maxLength }] }],
      [{ method: 'readString', args: [{ maxLength }], returnValue: string }],
    ]
  },

  'length-prefixed strings with custom encoding': (): ActionsPairs => {
    const chars = Array.from(
      new Set(random.string(random.integer(1, 20))).values()
    ).join('')
    const string = random.string(random.integer(0, 50), chars)
    const encoding = new CustomEncoding(chars)

    return [
      [{ method: 'writeString', args: [string, { encoding }] }],
      [{ method: 'readString', args: [{ encoding }], returnValue: string }],
    ]
  },

  'dynamic size uints': (): ActionsPairs => {
    const useMax = random.bool()
    const useSize = !useMax
    const max = useMax ? random.integer(0, 1 << 30) : undefined
    const size = useSize ? random.integer(0, 30) : undefined
    const number = random.integer(0, useMax ? max! : 1 << (size! - 1))

    return [
      [
        {
          method: 'writeUint',
          args: [number, { max, size } as { size: number }] as Parameters<
            BitWriter['writeUint']
          >,
        },
      ],
      [
        {
          method: 'readUint',
          args: [{ max, size } as { size: number }] as Parameters<
            BitReader['readUint']
          >,
          returnValue: number,
        },
      ],
    ]
  },

  'vararg uint1s': (): ActionsPairs => {
    const argCount = random.integer(0, 10)
    const args = new Array<0 | 1>(argCount)
      .fill(0)
      .map(() => random.integer(0, 1))

    return [
      [
        {
          method: 'writeUint1',
          args: args as Parameters<BitWriter['writeUint1']>,
        },
      ],
      args.map(arg => ({
        method: 'readUint1',
        args: [],
        returnValue: arg,
      })),
    ]
  },

  'vararg uint8s': (): ActionsPairs => {
    const argCount = random.integer(0, 10)
    const args = new Array<Uint8Index>(argCount)
      .fill(0)
      .map(() => random.integer(0, Uint8Size - 1))

    return [
      [
        {
          method: 'writeUint8',
          args: args as Parameters<BitWriter['writeUint8']>,
        },
      ],
      args.map(arg => ({
        method: 'readUint8',
        args: [],
        returnValue: arg,
      })),
    ]
  },
}

const testCaseNames = Object.getOwnPropertyNames(
  testCaseFactories
) as (keyof typeof testCaseFactories)[]

function doWritesAndReads([writes, reads]: ActionsPairs): void {
  const performedActions: PerformedAction<any>[] = []
  const writer = new BitWriter()

  for (const write of writes) {
    performAction(write, writer, performedActions)
  }

  const reader = new BitReader(writer.toUint8Array())

  for (const read of reads) {
    performAction(read, reader, performedActions)
  }
}

for (const testCase of testCaseNames) {
  test(testCase, () => {
    for (let i = 0; i < 1000; i += 1) {
      doWritesAndReads(testCaseFactories[testCase]())
    }
  })
}

test('all together', () => {
  for (let i = 0; i < 100; i += 1) {
    const factories = new Array(20)
      .fill(undefined)
      .map(() => testCaseFactories[random.pick(testCaseNames)])

    const [writes, reads]: ActionsPairs = [[], []]

    for (const factory of factories) {
      const [w, r] = factory()

      writes.push(...w)
      reads.push(...r)
    }

    doWritesAndReads([writes, reads])
  }
})

const codeColor = '\x1b[38;5;202m'
const resetColor = '\x1b[0m'

function formatAction<C extends Instance>(
  action: Action<C>,
  instance: C,
  includeReturnValue = false
): string {
  return `${codeColor}${instance.constructor.name}#${
    action.method
  }(${resetColor}${action.args
    .map(arg => inspect(arg, { colors: true }))
    .join(', ')}${codeColor})${resetColor}${
    includeReturnValue && typeof action.returnValue !== 'undefined'
      ? ` → ${inspect(action.returnValue, { colors: true })}`
      : ''
  }`
}

function formatActions<C extends Instance>(
  actions: PerformedAction<C>[]
): string {
  if (actions.length === 0) {
    return '- \x1b[38;5;240mn/a\x1b[0m'
  }

  return actions
    .map(action => `- ${formatAction(action, action.receiver, true)}`)
    .join('\n')
}

function performAction<C extends Instance>(
  action: Action<C>,
  instance: C,
  performedActions: PerformedAction<C>[]
): void {
  let actualValue: typeof action['returnValue']

  try {
    actualValue = instance[action.method](...action.args)
  } catch (error) {
    error.message = `After performing these actions:\n${formatActions(
      performedActions
    )}\n\nAction ${formatAction(action, instance)}${
      typeof action.returnValue === 'undefined'
        ? ''
        : ` (expected return ${inspect(action.returnValue, { colors: true })})`
    } failed with error message: ${error.message}`
    throw error
  }

  if (typeof action.returnValue !== 'undefined') {
    try {
      expect(actualValue).toEqual(action.returnValue)
    } catch (error) {
      error.message = `After performing these actions:\n${formatActions(
        performedActions
      )}\n\nAction ${formatAction(
        action,
        instance
      )} did not match expected value.\n\n${error.message}`
      throw error
    }
  }

  performedActions.push({ ...action, receiver: instance })
}
