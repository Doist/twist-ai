import { AWAY_MODE_TYPES, type AwayModeType, type TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockUser,
    extractStructuredContent,
    extractTextContent,
    TEST_ERRORS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { away } from '../away.js'

const mockTwistApi = {
    users: {
        getSessionUser: jest.fn(),
        update: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { AWAY } = ToolNames

describe(`${AWAY} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('get action', () => {
        it('should return away status when user is away', async () => {
            const mockUser = createMockUser({
                awayMode: {
                    type: 'vacation',
                    dateFrom: '2025-01-10',
                    dateTo: '2025-01-20',
                },
            })
            mockTwistApi.users.getSessionUser.mockResolvedValue(mockUser)

            const result = await away.execute({ action: 'get' }, mockTwistApi)

            expect(mockTwistApi.users.getSessionUser).toHaveBeenCalledWith()

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Status:** Away')
            expect(textContent).toContain('**Type:** Vacation')
            expect(textContent).toContain('**From:** 2025-01-10')
            expect(textContent).toContain('**To:** 2025-01-20')

            const structured = extractStructuredContent(result)
            expect(structured).toEqual(
                expect.objectContaining({
                    type: 'away_status',
                    action: 'get',
                    isAway: true,
                    awayMode: {
                        type: 'vacation',
                        dateFrom: '2025-01-10',
                        dateTo: '2025-01-20',
                    },
                }),
            )
        })

        it('should return not away when user has no away mode', async () => {
            const mockUser = createMockUser({ awayMode: undefined })
            mockTwistApi.users.getSessionUser.mockResolvedValue(mockUser)

            const result = await away.execute({ action: 'get' }, mockTwistApi)

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Status:** Not away')

            const structured = extractStructuredContent(result)
            expect(structured).toEqual(
                expect.objectContaining({
                    type: 'away_status',
                    action: 'get',
                    isAway: false,
                }),
            )
        })
    })

    describe('set action', () => {
        it('should set away mode with explicit from date', async () => {
            mockTwistApi.users.update.mockResolvedValue(createMockUser())

            const result = await away.execute(
                {
                    action: 'set',
                    type: 'vacation',
                    from: '2025-03-01',
                    until: '2025-03-15',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.users.update).toHaveBeenCalledWith({
                awayMode: {
                    type: 'vacation',
                    dateFrom: '2025-03-01',
                    dateTo: '2025-03-15',
                },
            })

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Type:** Vacation')
            expect(textContent).toContain('**From:** 2025-03-01')
            expect(textContent).toContain('**To:** 2025-03-15')

            const structured = extractStructuredContent(result)
            expect(structured).toEqual(
                expect.objectContaining({
                    type: 'away_status',
                    action: 'set',
                    isAway: true,
                }),
            )
        })

        it('should default from date to today when not provided', async () => {
            mockTwistApi.users.update.mockResolvedValue(createMockUser())

            // Mock the date to ensure consistent test results
            jest.useFakeTimers()
            jest.setSystemTime(new Date('2025-06-15T12:00:00Z'))

            const result = await away.execute(
                {
                    action: 'set',
                    type: 'sickleave',
                    until: '2025-06-20',
                },
                mockTwistApi,
            )

            jest.useRealTimers()

            expect(mockTwistApi.users.update).toHaveBeenCalledWith({
                awayMode: {
                    type: 'sickleave',
                    dateFrom: '2025-06-15',
                    dateTo: '2025-06-20',
                },
            })

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Type:** Sick leave')
        })

        it('should throw error when type is missing', async () => {
            await expect(
                away.execute(
                    { action: 'set', until: '2025-03-15' } as Parameters<typeof away.execute>[0],
                    mockTwistApi,
                ),
            ).rejects.toThrow('The "type" parameter is required when action is "set".')
        })

        it('should throw error when until is missing', async () => {
            await expect(
                away.execute(
                    { action: 'set', type: 'vacation' } as Parameters<typeof away.execute>[0],
                    mockTwistApi,
                ),
            ).rejects.toThrow('The "until" parameter is required when action is "set".')
        })

        it('should support all away mode types', async () => {
            mockTwistApi.users.update.mockResolvedValue(createMockUser())

            const expectedLabels: Record<AwayModeType, string> = {
                parental: 'Parental leave',
                vacation: 'Vacation',
                sickleave: 'Sick leave',
                other: 'Away',
            }

            for (const awayType of AWAY_MODE_TYPES) {
                const result = await away.execute(
                    {
                        action: 'set',
                        type: awayType,
                        from: '2025-01-01',
                        until: '2025-01-10',
                    },
                    mockTwistApi,
                )

                const textContent = extractTextContent(result)
                expect(textContent).toContain(`**Type:** ${expectedLabels[awayType]}`)
            }
        })
    })

    describe('clear action', () => {
        it('should clear away mode', async () => {
            mockTwistApi.users.update.mockResolvedValue(createMockUser())

            const result = await away.execute({ action: 'clear' }, mockTwistApi)

            expect(mockTwistApi.users.update).toHaveBeenCalledWith({
                awayMode: '' as never,
            })

            const textContent = extractTextContent(result)
            expect(textContent).toContain('Away Status Cleared')
            expect(textContent).toContain('**Status:** Not away')

            const structured = extractStructuredContent(result)
            expect(structured).toEqual(
                expect.objectContaining({
                    type: 'away_status',
                    action: 'clear',
                    isAway: false,
                }),
            )
        })
    })

    describe('error handling', () => {
        it('should propagate API errors on get', async () => {
            mockTwistApi.users.getSessionUser.mockRejectedValue(
                new Error(TEST_ERRORS.API_UNAUTHORIZED),
            )

            await expect(away.execute({ action: 'get' }, mockTwistApi)).rejects.toThrow(
                TEST_ERRORS.API_UNAUTHORIZED,
            )
        })

        it('should propagate API errors on set', async () => {
            mockTwistApi.users.update.mockRejectedValue(new Error(TEST_ERRORS.API_RATE_LIMIT))

            await expect(
                away.execute(
                    {
                        action: 'set',
                        type: 'vacation',
                        from: '2025-01-01',
                        until: '2025-01-10',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow(TEST_ERRORS.API_RATE_LIMIT)
        })

        it('should propagate API errors on clear', async () => {
            mockTwistApi.users.update.mockRejectedValue(new Error(TEST_ERRORS.API_UNAUTHORIZED))

            await expect(away.execute({ action: 'clear' }, mockTwistApi)).rejects.toThrow(
                TEST_ERRORS.API_UNAUTHORIZED,
            )
        })
    })
})
