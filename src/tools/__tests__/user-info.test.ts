import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockUser,
    extractStructuredContent,
    extractTextContent,
    TEST_ERRORS,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { userInfo } from '../user-info.js'

// Mock the Twist API
const mockTwistApi = {
    users: {
        getSessionUser: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { USER_INFO } = ToolNames

describe(`${USER_INFO} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should generate user info with all required fields', async () => {
        const mockUser = createMockUser()

        mockTwistApi.users.getSessionUser.mockResolvedValue(mockUser)

        const result = await userInfo.execute({}, mockTwistApi)

        expect(mockTwistApi.users.getSessionUser).toHaveBeenCalledWith()

        // Test text content contains expected information
        const textContent = extractTextContent(result)
        expect(textContent).toContain(`User ID:** ${TEST_IDS.USER_1}`)
        expect(textContent).toContain('Test User')
        expect(textContent).toContain('test@example.com')
        expect(textContent).toContain('UTC')
        expect(textContent).toContain(`Default Workspace:** ${TEST_IDS.WORKSPACE_1}`)
        expect(textContent).toContain('**Bot:** No')
        expect(textContent).toContain('**Language:** en')

        // Test structured content
        const structuredContent = extractStructuredContent(result)
        expect(structuredContent).toEqual(
            expect.objectContaining({
                type: 'user_info',
                userId: TEST_IDS.USER_1,
                email: 'test@example.com',
                name: 'Test User',
                timezone: 'UTC',
                defaultWorkspace: TEST_IDS.WORKSPACE_1,
                bot: false,
            }),
        )
    })

    it('should handle different timezones', async () => {
        const mockUser = createMockUser({
            timezone: 'America/New_York',
        })

        mockTwistApi.users.getSessionUser.mockResolvedValue(mockUser)

        const result = await userInfo.execute({}, mockTwistApi)

        const textContent = extractTextContent(result)
        expect(textContent).toContain('America/New_York')

        const structuredContent = extractStructuredContent(result)
        expect(structuredContent.timezone).toBe('America/New_York')
    })

    it('should handle users without profession', async () => {
        const mockUser = createMockUser({
            profession: undefined,
        })

        mockTwistApi.users.getSessionUser.mockResolvedValue(mockUser)

        const result = await userInfo.execute({}, mockTwistApi)

        const textContent = extractTextContent(result)
        expect(textContent).not.toContain('Profession')
    })

    it('should propagate API errors', async () => {
        const apiError = new Error(TEST_ERRORS.API_UNAUTHORIZED)
        mockTwistApi.users.getSessionUser.mockRejectedValue(apiError)

        await expect(userInfo.execute({}, mockTwistApi)).rejects.toThrow(
            TEST_ERRORS.API_UNAUTHORIZED,
        )
    })
})
