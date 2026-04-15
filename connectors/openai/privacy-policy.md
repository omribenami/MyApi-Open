# Privacy Policy — MyApi GPT

**Effective date:** 2026-04-14

## What this GPT does

This GPT connects to your MyApi account at **www.myapiai.com** to let you interact with your personal data and connected services through ChatGPT. It can read identity information, personas, knowledge base documents, service connection status, and can execute actions through your connected OAuth services — subject to the scopes you authorized.

## Data access and actions

- This GPT accesses your MyApi account using an OAuth access token you explicitly authorize.
- The GPT can **read** identity information, personas, knowledge base documents, and service connection status stored in your MyApi account.
- Depending on the scopes you granted, the GPT may also **execute actions** through your connected OAuth services (e.g., sending messages, creating files) via the MyApi service proxy. Review and limit the scopes you grant during OAuth authorization.
- The GPT does **not** store your data independently. All data and actions remain within your MyApi account.
- Conversation content may be processed and stored by OpenAI per their [Privacy Policy](https://openai.com/privacy).

## Data routing

Requests made by this GPT flow through the following layers:
1. **OpenAI (ChatGPT)** — receives your conversational input and sends API requests to MyApi on your behalf
2. **MyApi Service** — processes API requests, retrieves your data, constructs AI prompts
3. **OpenClaw Proxy** (when applicable) — routes AI model requests to Anthropic, Google, OpenAI, or other providers
4. **External AI Provider** — generates the AI response

Your data (prompts, context, persona content) may be seen at each layer above. Each layer has its own privacy policy.

## OAuth token

- When you first use this GPT, you authorize it to access your MyApi account via OAuth.
- Your access token is stored by ChatGPT/OpenAI and used only to call the MyApi API on your behalf.
- **You can revoke this access at any time** from your MyApi dashboard: Settings → Token Vault → find the "ChatGPT (OAuth)" token → revoke.
- Revoking access immediately prevents the GPT from making further calls to your MyApi account.

## Data retention

- MyApi stores your data per our [Privacy Policy](https://www.myapiai.com/privacy).
- Conversation history within ChatGPT is retained by OpenAI per their policies.
- MyApi audit logs record all API actions taken by this GPT under your account.

## Actions and authorization

**Important:** When this GPT proposes to take an action (such as sending a message, creating content, or interacting with a connected service), it should request your explicit approval before executing. You retain full control over what actions are performed on your behalf. MyApi's `llms.txt` file enforces a human-approval requirement for service executions.

## Contact

For MyApi privacy questions: **privacy@myapiai.com**  
For OpenAI/ChatGPT data questions: [OpenAI Privacy Policy](https://openai.com/privacy)
