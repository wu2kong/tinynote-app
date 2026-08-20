---
title: TinyNote AI Chat Configuration
description: Configure OpenAI-compatible models in TinyNote and use AI to organize or explain notes and commands.
---

# AI chat

TinyNote can talk to OpenAI-compatible models. Configuration is stored on this device only — it is not written into the library and is not Git-synced.

Shortcut: <kbd>Cmd</kbd>+<kbd>I</kbd> / <kbd>Ctrl</kbd>+<kbd>I</kbd>.

## Configure models

Open Settings → AI Models:

| Provider | Notes |
| --- | --- |
| OpenAI | Official API |
| OpenCode Go / Zen | OpenAI-compatible subscription endpoints |
| DeepSeek | Official DeepSeek API |
| Custom | Any OpenAI-compatible server or local model |

Typical steps:

1. Enable a provider
2. Enter the API key (optional for local models) and API URL
3. Fetch the model list, or add a model name by hand
4. Save

Then open chat with the shortcut and pick a model.

## Chat

- **Enter** to send, **Shift+Enter** for a new line
- Streaming output; you can stop mid-generation
- Copy or regenerate replies
- Session history: new, switch, delete
- If no provider with a key is enabled, chat asks you to configure one first

## Safety

- Do not put API keys into note content
- A new computer needs the AI settings filled in again
- Prompts are sent to the provider — avoid passwords and secrets
