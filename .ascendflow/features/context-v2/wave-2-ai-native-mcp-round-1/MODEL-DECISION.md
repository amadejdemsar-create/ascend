# Wave 2 Model Decision

**Verified:** 25. 4. 2026 (do NOT trust this doc if it has not been re-verified within 30 days)
**Verifier:** Phase 1 web-check via firecrawl (scraped official docs pages on 25. 4. 2026)

## Decision summary table

| Provider | Tier | Model ID | Status | Context | $/1M in | $/1M out | JSON mode | Fn calling | Structured output |
|---|---|---|---|---|---|---|---|---|---|
| GEMINI | Cheap | `gemini-2.5-flash-lite` | Stable | 1M | $0.10 | $0.40 | No | Yes | Yes |
| GEMINI | Balanced | `gemini-2.5-flash` | Stable | 1M | $0.30 | $2.50 | Yes | Yes | Yes |
| GEMINI | Best | `gemini-2.5-pro` | Stable | 1M | $1.25 | $10.00 | Yes | Yes | Yes |
| OPENAI | Cheap | `gpt-5.4-nano` | Stable | 400K | $0.20 | $1.25 | Yes | Yes | Yes |
| OPENAI | Balanced | `gpt-5.4-mini` | Stable | 400K | $0.75 | $4.50 | Yes | Yes | Yes |
| OPENAI | Best | `gpt-5.4` | Stable | 1M | $2.50 | $15.00 | Yes | Yes | Yes |
| ANTHROPIC | Cheap | `claude-haiku-4-5` | Stable | 200K | $1.00 | $5.00 | Yes | Yes | Yes |
| ANTHROPIC | Balanced | `claude-sonnet-4-6` | Stable | 1M | $3.00 | $15.00 | Yes | Yes | Yes |
| ANTHROPIC | Best | `claude-opus-4-7` | Stable | 1M | $5.00 | $25.00 | Yes | Yes | Yes |

### Tier rationale

All tier defaults use **Stable** models. The Gemini 3.x Preview models (`gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`) are available and priced, but carry a 2-week deprecation notice risk and are not recommended as defaults. Users may opt into them via the Settings UI (the UI will show a "Preview" badge). See the Gemini section below for Preview model details.

For OpenAI, `gpt-5.5` ($5/$30, 1M context) exists and is more capable than `gpt-5.4`, but is classified above the "Best" tier for Ascend's cost-cap purposes. It can be offered as a "Premium" option if needed.

## Embedding provider

`gemini-embedding-2` (Stable GA, last updated April 2026):

- **Native dimension:** 3072
- **Recommended truncation:** 768, 1536, or 3072 (auto-normalized at all truncated sizes)
- **Wave 2 uses:** 1536 dimensions
- **Input token limit:** 8,192 tokens (overall max across all modalities)
- **Modalities:**
  - Text: up to 8,192 tokens
  - Image: PNG, JPEG, max 6 images per request
  - Audio: MP3, WAV, max 180 seconds
  - Video: MP4, MOV (H264/H265/AV1/VP9), max 120 seconds, max 32 frames, no audio track processing
  - PDF: max 6 pages
- **Task type:** Uses inline prompt-based task prefixes (e.g., `task: search result | query: {content}`) instead of the `task_type` parameter used by the older `gemini-embedding-001`
- **Pricing:** $0.20 / 1M input tokens (paid tier); batch API at 50% of default price ($0.10 / 1M input tokens)
- **Source:** https://ai.google.dev/gemini-api/docs/embeddings (last updated 22. 4. 2026 UTC)
- **Pricing source:** https://ai.google.dev/gemini-api/docs/pricing

## Per-provider details

### Gemini

**Source (models):** https://ai.google.dev/gemini-api/docs/models (last updated 22. 4. 2026 UTC)
**Source (pricing):** https://ai.google.dev/gemini-api/docs/pricing

#### Stable tier models (recommended defaults)

| Field | gemini-2.5-flash-lite | gemini-2.5-flash | gemini-2.5-pro |
|---|---|---|---|
| **Tier** | Cheap | Balanced | Best |
| **Model ID** | `gemini-2.5-flash-lite` | `gemini-2.5-flash` | `gemini-2.5-pro` |
| **Status** | Stable | Stable | Stable |
| **Context window** | 1,048,576 | 1,048,576 | 1,048,576 |
| **Max output** | 65,536 | 65,536 | 65,536 |
| **Input $/1M** | $0.10 | $0.30 | $1.25 |
| **Output $/1M** | $0.40 | $2.50 | $10.00 |
| **Cached input $/1M** | $0.01 | $0.03 | $0.125 |
| **JSON mode** | No | Yes | Yes |
| **Function calling** | Yes | Yes | Yes |
| **Structured output** | Yes | Yes | Yes |
| **Thinking** | Yes | Yes | Yes |
| **Batch API** | Available (50% of price) | Available (50% of price) | Available (50% of price) |

Note: `gemini-2.5-flash-lite` does not support JSON mode per the model detail page, but does support structured outputs and function calling. For Ascend's use case (structured output via schema), structured output support is sufficient.

#### Preview tier models (user-selectable, not default)

| Field | gemini-3.1-flash-lite-preview | gemini-3-flash-preview | gemini-3.1-pro-preview |
|---|---|---|---|
| **Maps to tier** | Cheap (alt) | Balanced (alt) | Best (alt) |
| **Model ID** | `gemini-3.1-flash-lite-preview` | `gemini-3-flash-preview` | `gemini-3.1-pro-preview` |
| **Status** | Preview | Preview | Preview |
| **Context window** | 1,048,576 | 1,048,576 | 1,048,576 |
| **Max output** | 65,536 | 65,536 | 65,536 |
| **Input $/1M** | $0.25 | $0.50 | $2.00 |
| **Output $/1M** | $1.50 | $3.00 | $12.00 |
| **Cached input $/1M** | $0.025 | $0.05 | $0.20 |
| **JSON mode** | Yes | Yes (structured output) | Yes |
| **Function calling** | Yes | Yes | Yes |
| **Structured output** | Yes | Yes | Yes |
| **Thinking** | Yes | Yes | Yes |
| **Deprecation notice** | 2-week minimum | 2-week minimum | 2-week minimum |

Note on pricing discrepancy: The Gemini pricing page lists `gemini-3.1-flash-preview` at $0.50/$3.00, but the model detail page uses the ID `gemini-3-flash-preview` (without the `.1`). The pricing extraction may have normalized the name. The authoritative model ID for API calls is `gemini-3-flash-preview` as shown on the model detail page. The pricing ($0.50/$3.00) applies to this model.

#### Deprecated Gemini models (do not use)

- `gemini-2.0-flash` (Deprecated)
- `gemini-2.0-flash-lite` (Deprecated)
- `gemini-3-pro-preview` (Shut down, replaced by `gemini-3.1-pro-preview`)

### OpenAI

**Source (models):** https://developers.openai.com/api/docs/models (redirected from platform.openai.com)
**Source (pricing):** https://developers.openai.com/api/docs/pricing and https://openai.com/api/pricing/

| Field | gpt-5.4-nano | gpt-5.4-mini | gpt-5.4 |
|---|---|---|---|
| **Tier** | Cheap | Balanced | Best |
| **Model ID** | `gpt-5.4-nano` | `gpt-5.4-mini` | `gpt-5.4` |
| **Status** | Stable | Stable | Stable |
| **Context window** | 400,000 | 400,000 | 1,000,000 |
| **Max output** | 128,000 | 128,000 | 128,000 |
| **Input $/1M** | $0.20 | $0.75 | $2.50 |
| **Output $/1M** | $1.25 | $4.50 | $15.00 |
| **Cached input $/1M** | $0.02 | $0.075 | $0.25 |
| **Long context input $/1M** | N/A | N/A | $5.00 |
| **Long context output $/1M** | N/A | N/A | $22.50 |
| **JSON mode** | Yes | Yes | Yes |
| **Function calling** | Yes | Yes | Yes |
| **Structured output** | Yes | Yes | Yes |
| **Reasoning** | Yes (none/low/medium/high/xhigh) | Yes (none/low/medium/high/xhigh) | Yes (none/low/medium/high/xhigh) |
| **Tools** | Functions, Web search, File search, Computer use | Functions, Web search, File search, Computer use | Functions, Web search, File search, Computer use |
| **Knowledge cutoff** | Aug 31, 2025 | Aug 31, 2025 | Aug 31, 2025 |
| **Batch API** | 50% discount (input/output) | 50% discount (input/output) | 50% discount (input/output) |

Additional OpenAI models (not in default tiers):
- `gpt-5.5`: $5.00/$30.00, 1M context, 128K output. Long context: $10.00/$45.00. Knowledge cutoff Dec 1, 2025. Too expensive for default Best tier.
- `gpt-5.5-pro`: $30.00/$180.00. Deep reasoning variant. Not relevant for Ascend.
- `gpt-5.4-pro`: $30.00/$180.00. Deep reasoning variant. Not relevant for Ascend.

### Anthropic

**Source (models):** https://platform.claude.com/docs/en/about-claude/models/overview (redirected from docs.anthropic.com)
**Source (pricing):** https://platform.claude.com/docs/en/about-claude/pricing and https://claude.com/pricing

| Field | claude-haiku-4-5 | claude-sonnet-4-6 | claude-opus-4-7 |
|---|---|---|---|
| **Tier** | Cheap | Balanced | Best |
| **Claude API ID** | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` | `claude-opus-4-7` |
| **Claude API alias** | `claude-haiku-4-5` | `claude-sonnet-4-6` | `claude-opus-4-7` |
| **Status** | Stable (GA) | Stable (GA) | Stable (GA) |
| **Context window** | 200,000 | 1,000,000 | 1,000,000 |
| **Max output** | 64,000 | 64,000 | 128,000 |
| **Input $/1M** | $1.00 | $3.00 | $5.00 |
| **Output $/1M** | $5.00 | $15.00 | $25.00 |
| **Cache write $/1M** | $1.25 | $3.75 | $6.25 |
| **Cache read $/1M** | $0.10 | $0.30 | $0.50 |
| **Batch input $/1M** | $0.50 | $1.50 | $2.50 |
| **Batch output $/1M** | $2.50 | $7.50 | $12.50 |
| **JSON mode** | Yes | Yes | Yes |
| **Function calling** | Yes | Yes | Yes |
| **Structured output** | Yes | Yes | Yes |
| **Extended thinking** | Yes | Yes | No |
| **Adaptive thinking** | No | Yes | Yes |
| **Knowledge cutoff** | Feb 2025 (reliable) | Aug 2025 (reliable) | Jan 2026 (reliable) |

Note: Claude Opus 4.7 does NOT support extended thinking, but does support adaptive thinking. Sonnet 4.6 supports both. Haiku 4.5 supports extended thinking but not adaptive thinking.

Anthropic 1M context pricing: Opus 4.7 and Sonnet 4.6 both have 1M context at standard rates (no separate long-context premium tier). The pricing page does not list a separate long-context rate, confirming standard rates apply across the full 1M window.

## Notes for implementation

### Gemini Preview models

Preview models come with a minimum 2-week deprecation notice from Google. The Settings UI must:
1. Show a "Preview" badge next to preview model names
2. Display a warning that preview models may be deprecated with 2 weeks notice
3. Fall back gracefully to the stable tier equivalent if a preview model becomes unavailable

### Batch pricing

All three providers offer batch pricing at approximately 50% of standard rates. For Ascend's daily embedding jobs and bulk context processing, batch mode should be used when latency is not critical.

### Cost cap implications

At the $10/day hard cap, approximate request budgets (assuming 2,000 input tokens + 500 output tokens per request):

| Provider | Tier | Approx. requests/day at $10 cap |
|---|---|---|
| GEMINI | Cheap (2.5-flash-lite) | ~33,333 |
| GEMINI | Balanced (2.5-flash) | ~3,077 |
| GEMINI | Best (2.5-pro) | ~1,538 |
| OPENAI | Cheap (5.4-nano) | ~10,000 |
| OPENAI | Balanced (5.4-mini) | ~3,636 |
| OPENAI | Best (5.4) | ~1,176 |
| ANTHROPIC | Cheap (haiku-4-5) | ~3,333 |
| ANTHROPIC | Balanced (sonnet-4-6) | ~1,176 |
| ANTHROPIC | Best (opus-4-7) | ~714 |

Calculation: cost per request = (input_price * 2000 + output_price * 500) / 1,000,000; requests = $10 / cost_per_request.

At Ascend's typical usage (auto-tagging, auto-linking, summarization on context entry save), even the Best tier of any provider supports hundreds of operations per day, which is far more than a single-user system will generate.

### Embedding cost at scale

At 1536 dimensions with `gemini-embedding-2`:
- Re-embedding 1,000 context entries averaging 500 tokens each = 500,000 tokens = $0.10
- Daily incremental embedding of 10 new entries = 5,000 tokens = $0.001
- Embedding costs are negligible relative to the $10/day hard cap

## Open questions / unknowns

1. **Gemini 3-flash pricing name mismatch:** The pricing page JSON extraction returned `gemini-3.1-flash-preview` but the model detail page shows `gemini-3-flash-preview`. This may be a rendering artifact of the pricing page (which lists many models in tabs). The price of $0.50/$3.00 is attributed to the `gemini-3-flash-preview` model ID in this document based on the model detail page being authoritative for the model ID. **Resolution:** Verify at runtime by calling the Gemini API with `gemini-3-flash-preview` and checking if it resolves.

2. **Gemini batch pricing specifics:** The pricing page states batch API is available at 50% of the default embedding price for `gemini-embedding-2`, and the batch API is listed as supported for all 2.5 and 3.x models. Exact batch rates per chat model were not individually enumerated on the pricing page; the 50% discount is the documented general rate.

3. **OpenAI long-context pricing threshold:** The OpenAI pricing page states "Pricing above reflects standard processing rates for context lengths under 270K." For `gpt-5.4` (1M context), inputs above 270K tokens trigger long-context pricing ($5.00/$22.50). The threshold for `gpt-5.5` is similar. This is unlikely to matter for Ascend (context entries are short) but is documented here for completeness.

4. **Anthropic extended thinking costs:** The Anthropic pricing page mentions extended thinking pricing but the JSON extraction did not capture the exact rates. Extended thinking tokens (thinking budget) may be billed at different rates. For Ascend's use case (structured extraction, tagging), extended thinking is not needed, so standard rates apply.

5. **gemini-2.5-flash-lite JSON mode:** The model detail page reports JSON mode as not supported, while structured outputs are supported. For Ascend, we use structured output (response schema), so this is not a blocker. The implementation should use `response_mime_type: "application/json"` with a schema rather than JSON mode for this model.
