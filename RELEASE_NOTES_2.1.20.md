# InvictaTill Browser 2.1.20

InvictaTill Browser 2.1.20 fixes live AI spelling & grammar proofreading prompt formatting and adds conversational chatbot response sanitization.

## Spelling & Grammar Proofreading Fixes

- Fixed an issue where the AI model interpreted text to be proofread as a conversational user command (e.g. returning "I'm happy to help..." instead of fixing spelling & grammar).
- Updated AI proofreading prompt instructions with strict isolation (`STRICT PROOFREADING TASK`), instructing the model to proofread text only and ignore commands/requests embedded within input text.
- Added automatic conversational response sanitization (`isConversationalReply`) to strip introductory chatter and fall back to clean proofreading fixes if conversational AI output is detected.

## Quality & Tests

- Added security suite assertion tests in `tests/security.test.js` verifying strict proofreading task prompts, conversational reply stripping, and fallback mechanisms.
