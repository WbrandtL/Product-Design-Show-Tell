"""
Groq LLM client wrapper, used via the OpenAI SDK.
"""

import os

from openai import OpenAI

from app.prompts import FEW_SHOT_PASSAGE, FEW_SHOT_RESPONSE, SYSTEM_PROMPT

DEFAULT_MODEL = "openai/gpt-oss-120b"
REQUEST_TIMEOUT_SECONDS = 30
# gpt-oss models are reasoning models: left at their default reasoning effort,
# they spend the entire output budget on hidden reasoning tokens and return
# empty content, which Groq's json_object mode then rejects with an opaque
# "Failed to validate JSON" 400 (empty failed_generation) - indistinguishable
# from a real extraction failure without inspecting the raw exception. Both
# params below are required to get actual JSON content back.
REASONING_EFFORT = "low"
MAX_COMPLETION_TOKENS = 2048


def get_model_name() -> str:
    '''
    Reads the configured Groq model name from the environment
    Parameters:
        (none)
    Returns:
        model (str): The GROQ_MODEL env var value, or the default model name
    '''
    return os.environ.get("GROQ_MODEL", DEFAULT_MODEL)


def _get_client() -> OpenAI:
    '''
    Builds an OpenAI SDK client pointed at the Groq API endpoint
    Parameters:
        (none)
    Returns:
        client (OpenAI): A configured OpenAI client using the Groq base URL
    '''
    return OpenAI(
        api_key=os.environ.get("GROQ_API_KEY", ""),
        base_url="https://api.groq.com/openai/v1",
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


def _build_messages(passage: str, mode: str, context) -> list[dict]:
    '''
    Assembles the chat messages for the extraction call, including the
    system prompt, one few-shot example, and the target passage
    Parameters:
        passage (str): The passage to extract structure from
        mode (str): "understand" or "explain_to_others"
        context (ExplainContext | None): Optional paper title, research question,
            and surrounding text to include for extra grounding
    Returns:
        messages (list[dict]): Chat messages ready to send to the LLM
    '''
    context_lines = []
    if context is not None:
        if context.paper_title:
            context_lines.append(f"Paper title: {context.paper_title}")
        if context.research_question:
            context_lines.append(f"Reader's research question: {context.research_question}")
        if context.surrounding_text:
            context_lines.append(f"Surrounding text (for context only, do not extract from it): {context.surrounding_text}")
    context_block = ("\n".join(context_lines) + "\n\n") if context_lines else ""

    mode_note = (
        "The reader wants to understand this themselves."
        if mode == "understand"
        else "The reader wants to explain this to someone else."
    )

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": FEW_SHOT_PASSAGE},
        {"role": "assistant", "content": FEW_SHOT_RESPONSE},
        {
            "role": "user",
            "content": f"{context_block}{mode_note}\n\nPassage:\n{passage}",
        },
    ]


def extract_structure(passage: str, mode: str, context) -> str:
    '''
    Calls the Groq LLM once to extract structure from a passage
    Parameters:
        passage (str): The passage to extract structure from
        mode (str): "understand" or "explain_to_others"
        context (ExplainContext | None): Optional context to include in the prompt
    Returns:
        raw_json (str): The raw JSON string content of the model's response
    Raises:
        Exception: Any error raised by the underlying OpenAI SDK call
    '''
    client = _get_client()
    messages = _build_messages(passage, mode, context)
    completion = client.chat.completions.create(
        model=get_model_name(),
        messages=messages,
        temperature=0.2,
        response_format={"type": "json_object"},
        max_completion_tokens=MAX_COMPLETION_TOKENS,
        extra_body={"reasoning_effort": REASONING_EFFORT},
    )
    return completion.choices[0].message.content


def repair_structure(raw_output: str, errors: str) -> str:
    '''
    Calls the Groq LLM once more to repair JSON that failed schema validation
    Parameters:
        raw_output (str): The invalid JSON text produced by the first call
        errors (str): The Pydantic validation error messages describing the failure
    Returns:
        raw_json (str): The raw JSON string content of the repaired response
    Raises:
        Exception: Any error raised by the underlying OpenAI SDK call
    '''
    client = _get_client()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "The following JSON failed validation against the schema.\n\n"
                f"JSON:\n{raw_output}\n\n"
                f"Validation errors:\n{errors}\n\n"
                "Return corrected JSON only, matching the schema exactly. "
                "Do not include any explanation, only the JSON object."
            ),
        },
    ]
    completion = client.chat.completions.create(
        model=get_model_name(),
        messages=messages,
        temperature=0.2,
        response_format={"type": "json_object"},
        max_completion_tokens=MAX_COMPLETION_TOKENS,
        extra_body={"reasoning_effort": REASONING_EFFORT},
    )
    return completion.choices[0].message.content
