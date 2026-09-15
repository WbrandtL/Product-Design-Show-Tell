"""
Command-line harness for the /v1/explain pipeline.

Calls run_explain_pipeline() directly — no server, no browser, no curl.
Uses the exact same code path as the HTTP endpoint (cache, LLM extraction,
repair, span verification, fixture fallback), so this is a true test of the
pipeline, just with the fastest possible feedback loop.

Examples:
    python scripts/try_explain.py --sample trust
    python scripts/try_explain.py --sample climate_feedback --mode explain_to_others
    python scripts/try_explain.py --file my_passage.txt
    echo "some long passage..." | python scripts/try_explain.py --stdin
    python scripts/try_explain.py --sample trust --json
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.cache import init_db
from app.pipeline import run_explain_pipeline
from app.samples import SAMPLE_PASSAGES

init_db()

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"
YELLOW = "\033[33m"
GREEN = "\033[32m"
RED = "\033[31m"


def build_arg_parser() -> argparse.ArgumentParser:
    '''
    Builds the CLI argument parser
    Parameters:
        (none)
    Returns:
        parser (argparse.ArgumentParser): Configured argument parser
    '''
    parser = argparse.ArgumentParser(
        description="Run the /v1/explain pipeline directly against a passage, no server needed."
    )
    source = parser.add_mutually_exclusive_group()
    source.add_argument(
        "--sample",
        choices=[s["id"] for s in SAMPLE_PASSAGES],
        help="Use one of the built-in sample passages.",
    )
    source.add_argument("--file", type=str, help="Read the passage from a text file.")
    source.add_argument("--stdin", action="store_true", help="Read the passage from stdin.")
    source.add_argument("--text", type=str, help="Pass the passage directly as a string.")
    parser.add_argument(
        "--mode",
        choices=["understand", "explain_to_others"],
        default="understand",
        help="Changes takeaway/explain_script emphasis only (default: understand).",
    )
    parser.add_argument("--json", action="store_true", help="Print raw JSON instead of the formatted view.")
    return parser


def resolve_passage(args: argparse.Namespace) -> str:
    '''
    Resolves the passage text to send to the pipeline based on CLI arguments
    Parameters:
        args (argparse.Namespace): Parsed CLI arguments
    Returns:
        passage (str): The passage text to explain
    Raises:
        SystemExit: If no passage source is given or a file/stdin read fails
    '''
    if args.sample:
        return next(s["text"] for s in SAMPLE_PASSAGES if s["id"] == args.sample)
    if args.file:
        return Path(args.file).read_text()
    if args.stdin:
        return sys.stdin.read()
    if args.text:
        return args.text

    print(f"{YELLOW}No passage source given — defaulting to sample '{SAMPLE_PASSAGES[0]['id']}'.{RESET}")
    print(f"{DIM}(use --sample/--file/--stdin/--text to choose one explicitly){RESET}\n")
    return SAMPLE_PASSAGES[0]["text"]


def print_formatted(response) -> None:
    '''
    Pretty-prints an ExplainResponse to the terminal with colored sections
    Parameters:
        response (ExplainResponse): The pipeline result to display
    Returns:
        None
    '''
    meta = response.meta
    print(f"{BOLD}{CYAN}── {response.passage_pattern} → {response.layout_hint} ──{RESET}")
    print(
        f"{DIM}model={meta.model} cached={meta.cached} latency={meta.latency_ms}ms "
        f"spans verified/repaired/dropped={meta.spans_verified}/{meta.spans_repaired}/{meta.spans_dropped}{RESET}\n"
    )

    print(f"{BOLD}Takeaway:{RESET} {response.takeaway}")
    print(f"{BOLD}Explain script:{RESET} {response.explain_script}\n")

    print(f"{BOLD}{MAGENTA}Nodes{RESET}")
    for level, label in ((1, "central"), (2, "supporting"), (3, "background")):
        group = [n for n in response.nodes if n.emphasis == level]
        if not group:
            continue
        print(f"  {DIM}emphasis {level} ({label}){RESET}")
        for n in group:
            span = f"[{n.source_span[0]}:{n.source_span[1]}]" if n.source_span else "[no span]"
            print(f"    • {BOLD}{n.label}{RESET} ({n.kind}) {DIM}{span}{RESET} — {n.one_line}")

    print(f"\n{BOLD}{MAGENTA}Edges{RESET}")
    nodes_by_id = {n.id: n for n in response.nodes}
    for e in response.edges:
        src = nodes_by_id.get(e.source)
        tgt = nodes_by_id.get(e.target)
        src_label = src.label if src else e.source
        tgt_label = tgt.label if tgt else e.target
        tag = f"{GREEN}[stated]{RESET}" if e.evidentiality == "stated" else f"{YELLOW}[inferred]{RESET}"
        print(f"  {src_label} — {e.label} → {tgt_label} {tag}")

    if response.glossary:
        print(f"\n{BOLD}{MAGENTA}Glossary{RESET}")
        for g in response.glossary:
            print(f"  • {BOLD}{g.term}{RESET}: {g.plain_definition}")
            print(f"    {DIM}here: {g.in_this_passage}{RESET}")

    if response.simplifications:
        print(f"\n{BOLD}{MAGENTA}Simplifications{RESET}")
        for s in response.simplifications:
            print(f"  • {s}")

    print(f"\n{DIM}id={response.id}{RESET}")


def main() -> None:
    '''
    CLI entrypoint: parses arguments, runs the pipeline, and prints the result
    Parameters:
        (none)
    Returns:
        None
    Raises:
        SystemExit: If the pipeline raises (e.g. 502-equivalent validation failure)
    '''
    args = build_arg_parser().parse_args()
    passage = resolve_passage(args).strip()

    if len(passage) < 200 or len(passage) > 4000:
        print(
            f"{RED}Passage is {len(passage)} characters; the pipeline requires 200-4000.{RESET}",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        response = run_explain_pipeline(passage, args.mode, None)
    except Exception as exc:
        print(f"{RED}Pipeline failed: {exc}{RESET}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(response.model_dump_json(indent=2))
    else:
        print_formatted(response)


if __name__ == "__main__":
    main()
