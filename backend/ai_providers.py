"""BYO-key AI provider adapters: OpenAI, Anthropic (Claude), Google Gemini, Ollama.
All calls use httpx async. Keys are supplied per-request (decrypted from user settings).
"""
import json
import re
import logging
import httpx

logger = logging.getLogger(__name__)

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-haiku-20241022",
    "gemini": "gemini-2.0-flash",
    "ollama": "llama3.2",
}

ANALYSIS_PROMPT = """You are an expert resume reviewer. Compare the RESUME against the JOB DESCRIPTION and respond with ONLY a JSON object (no markdown fences, no extra text) with these exact keys:
{{
  "score": <number 0-100, how well the resume matches the job>,
  "summary": "<2-3 plain sentences about the overall fit>",
  "strengths": ["<3-5 short bullet points about what matches well>"],
  "gaps": ["<3-5 short bullet points about what is missing or weak>"],
  "suggestions": ["<3-5 specific, actionable improvements>"]
}}

RESUME:
{resume}

JOB DESCRIPTION:
{jd}
"""

TEST_PROMPT = "Reply with exactly: OK"


class AIProviderError(Exception):
    pass


def _extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    raise AIProviderError("The AI response could not be understood. Try again.")


async def _call_openai(api_key, prompt, model=None, base_url="https://api.openai.com/v1"):
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model or DEFAULT_MODELS["openai"],
                  "messages": [{"role": "user", "content": prompt}],
                  "temperature": 0.2},
        )
    if r.status_code == 401:
        raise AIProviderError("Invalid OpenAI API key.")
    if r.status_code == 429:
        raise AIProviderError("OpenAI rate limit or quota reached. Check your plan/billing.")
    if r.status_code != 200:
        raise AIProviderError(f"OpenAI error ({r.status_code}): {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"]


async def _call_anthropic(api_key, prompt, model=None):
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            json={"model": model or DEFAULT_MODELS["anthropic"],
                  "max_tokens": 1500,
                  "messages": [{"role": "user", "content": prompt}]},
        )
    if r.status_code == 401:
        raise AIProviderError("Invalid Anthropic API key.")
    if r.status_code == 429:
        raise AIProviderError("Anthropic rate limit reached. Try again shortly.")
    if r.status_code != 200:
        raise AIProviderError(f"Anthropic error ({r.status_code}): {r.text[:200]}")
    return r.json()["content"][0]["text"]


async def _call_gemini(api_key, prompt, model=None):
    model = model or DEFAULT_MODELS["gemini"]
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
    if r.status_code in (401, 403):
        raise AIProviderError("Invalid Gemini API key.")
    if r.status_code == 429:
        raise AIProviderError("Gemini rate limit reached. Try again shortly.")
    if r.status_code != 200:
        raise AIProviderError(f"Gemini error ({r.status_code}): {r.text[:200]}")
    data = r.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise AIProviderError("Gemini returned an empty response.")


async def _call_ollama(base_url, prompt, model=None):
    base = (base_url or "http://localhost:11434").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{base}/api/generate",
                json={"model": model or DEFAULT_MODELS["ollama"], "prompt": prompt, "stream": False},
            )
    except httpx.ConnectError:
        raise AIProviderError(f"Could not reach Ollama at {base}. Is it running? Note: a local Ollama is only reachable when you run this app locally.")
    if r.status_code == 404:
        raise AIProviderError("Model not found in Ollama. Pull it first, e.g. `ollama pull llama3.2`.")
    if r.status_code != 200:
        raise AIProviderError(f"Ollama error ({r.status_code}): {r.text[:200]}")
    return r.json().get("response", "")


async def run_prompt(provider: str, credential: str, prompt: str, model: str = None):
    """credential = api key for cloud providers, base_url for ollama."""
    if provider == "openai":
        return await _call_openai(credential, prompt, model)
    if provider == "anthropic":
        return await _call_anthropic(credential, prompt, model)
    if provider == "gemini":
        return await _call_gemini(credential, prompt, model)
    if provider == "ollama":
        return await _call_ollama(credential, prompt, model)
    raise AIProviderError(f"Unknown provider: {provider}")


async def ai_analyze(provider: str, credential: str, resume_text: str, jd_text: str, model: str = None):
    prompt = ANALYSIS_PROMPT.format(resume=resume_text[:6000], jd=jd_text[:4000])
    raw = await run_prompt(provider, credential, prompt, model)
    parsed = _extract_json(raw)
    return {
        "score": max(0, min(100, float(parsed.get("score", 0)))),
        "summary": str(parsed.get("summary", "")),
        "strengths": [str(s) for s in parsed.get("strengths", [])][:6],
        "gaps": [str(s) for s in parsed.get("gaps", [])][:6],
        "suggestions": [str(s) for s in parsed.get("suggestions", [])][:6],
    }


async def test_connection(provider: str, credential: str, model: str = None):
    raw = await run_prompt(provider, credential, TEST_PROMPT, model)
    return bool(raw and len(raw.strip()) > 0)
