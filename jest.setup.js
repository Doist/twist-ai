// Suppress Node.js unhandled rejection warnings during tests
// This is safe because we intentionally create rejected promises in mocks that are properly handled
process.on('unhandledRejection', (reason) => {
    // Only suppress expected test errors
    if (
        reason instanceof Error &&
        (reason.message.includes('Thread not found') ||
            reason.message.includes('Conversation not found') ||
            reason.message.includes('Batch failed') ||
            reason.message.includes('Network timeout'))
    ) {
        // These are expected errors in our tests, don't log them
        return
    }
    // Re-throw unexpected errors
    throw reason
})
