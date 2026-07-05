#!/usr/bin/env python3
"""Run Fallow without mutating the target repository and summarize the result."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


EXCLUDED_DIRS = {".git", "node_modules", ".next", "dist", "build", "coverage"}


def run_capture(cmd: list[str], cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
        check=False,
    )


def git_status(repo: Path) -> str:
    result = run_capture(["git", "status", "--short", "--branch"], repo, 30)
    if result.returncode != 0:
        return f"<git status unavailable: {result.stderr.strip() or result.stdout.strip()}>"
    return result.stdout.strip()


def iter_files(repo: Path, names: set[str]) -> list[str]:
    matches: list[str] = []
    for root, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file_name in files:
            if file_name in names or file_name.startswith(".fallowrc"):
                full = Path(root) / file_name
                matches.append(str(full.relative_to(repo)))
    return sorted(matches)


def fallow_files(repo: Path) -> list[str]:
    matches: list[str] = []
    for root, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file_name in files:
            if file_name.startswith(".fallow") or file_name == "fallow.toml":
                full = Path(root) / file_name
                matches.append(str(full.relative_to(repo)))
    return sorted(matches)


def detect_adoption(repo: Path) -> dict[str, Any]:
    package_paths = iter_files(repo, {"package.json"})
    configs = iter_files(repo, {"fallow.toml", ".fallowrc.json", ".fallowrc.jsonc"})
    package_hits: list[str] = []

    for rel in package_paths:
        package_file = repo / rel
        try:
            data = json.loads(package_file.read_text())
        except Exception:
            continue

        scripts = data.get("scripts", {}) if isinstance(data, dict) else {}
        deps = data.get("dependencies", {}) if isinstance(data, dict) else {}
        dev_deps = data.get("devDependencies", {}) if isinstance(data, dict) else {}
        text = json.dumps({"scripts": scripts, "dependencies": deps, "devDependencies": dev_deps})
        if "fallow" in text:
            package_hits.append(rel)

    return {
        "package_json_count": len(package_paths),
        "config_files": configs,
        "package_hits": package_hits,
        "adopted": bool(configs or package_hits),
    }


def slugify(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-")
    return value[:80] or "repo"


def choose_fallow_cmd() -> list[str]:
    fallow = shutil.which("fallow")
    if fallow:
        return [fallow]

    npx = shutil.which("npx")
    if npx:
        return [npx, "--yes", "fallow"]

    raise SystemExit("Fallow is not available: expected `fallow` or `npx` on PATH.")


def build_command(args: argparse.Namespace) -> list[str]:
    base = choose_fallow_cmd()

    if args.mode == "audit":
        cmd = base + ["audit", "--no-cache", "--format", "json", "--quiet", "--explain"]
        if args.base:
            cmd += ["--base", args.base]
    elif args.mode == "full":
        cmd = base + ["--no-cache", "--format", "json", "--quiet"]
    else:
        cmd = base + [args.mode, "--no-cache", "--format", "json", "--quiet"]

    if args.production:
        cmd.append("--production")
    if args.workspace:
        cmd += ["--workspace", args.workspace]

    return cmd


def summarize_json(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        return {"json_shape": type(data).__name__}

    dead_code = data.get("dead_code") if isinstance(data.get("dead_code"), dict) else {}
    dead_summary = dead_code.get("summary", {}) if isinstance(dead_code, dict) else {}

    sample_unused_deps = []
    for item in (dead_code.get("unused_dependencies", []) if isinstance(dead_code, dict) else [])[:10]:
        if isinstance(item, dict):
            sample_unused_deps.append(
                {
                    "package": item.get("package_name"),
                    "path": item.get("path"),
                    "line": item.get("line"),
                    "location": item.get("location"),
                }
            )

    return {
        "version": data.get("version"),
        "command": data.get("command"),
        "verdict": data.get("verdict"),
        "base_ref": data.get("base_ref"),
        "changed_files_count": data.get("changed_files_count"),
        "elapsed_ms": data.get("elapsed_ms"),
        "summary": data.get("summary"),
        "attribution": data.get("attribution"),
        "dead_code_summary": dead_summary,
        "sample_unused_dependencies": sample_unused_deps,
    }


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", nargs="?", default=".", help="Target repo path.")
    parser.add_argument("--mode", choices=["audit", "full", "dead-code", "dupes", "health"], default="audit")
    parser.add_argument("--base", default=None, help="Base ref for audit mode, for example origin/main.")
    parser.add_argument("--workspace", default=None, help="Optional Fallow workspace selector.")
    parser.add_argument("--production", action="store_true", help="Run Fallow in production mode.")
    parser.add_argument("--out-dir", default=None, help="External output directory. Defaults to /tmp/fallow-readonly/...")
    parser.add_argument("--timeout", type=int, default=180, help="Command timeout in seconds.")
    args = parser.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    if not repo.exists():
        print(f"Repo path does not exist: {repo}", file=sys.stderr)
        return 2

    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = Path(args.out_dir).expanduser().resolve() if args.out_dir else Path("/tmp/fallow-readonly") / f"{slugify(repo.name)}-{timestamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    adoption = detect_adoption(repo)
    status_before = git_status(repo)
    fallow_before = fallow_files(repo)
    cmd = build_command(args)

    result = run_capture(cmd, repo, args.timeout)

    stdout_path = out_dir / "fallow.stdout.json"
    stderr_path = out_dir / "fallow.stderr.txt"
    summary_path = out_dir / "summary.json"

    write_text(stdout_path, result.stdout)
    write_text(stderr_path, result.stderr)

    parsed: Any = None
    parse_error = None
    if result.stdout.strip():
        try:
            parsed = json.loads(result.stdout)
        except Exception as exc:
            parse_error = str(exc)

    status_after = git_status(repo)
    fallow_after = fallow_files(repo)
    summary = {
        "repo": str(repo),
        "mode": args.mode,
        "command": cmd,
        "exit_code": result.returncode,
        "adoption": adoption,
        "status_before": status_before,
        "status_after": status_after,
        "git_status_changed": status_before != status_after,
        "fallow_files_before": fallow_before,
        "fallow_files_after": fallow_after,
        "fallow_files_changed": fallow_before != fallow_after,
        "stdout_path": str(stdout_path),
        "stderr_path": str(stderr_path),
        "parse_error": parse_error,
        "parsed_summary": summarize_json(parsed) if parsed is not None else None,
    }
    write_text(summary_path, json.dumps(summary, indent=2) + "\n")

    verdict = None
    top_signal = "no JSON summary"
    if isinstance(summary["parsed_summary"], dict):
        parsed_summary = summary["parsed_summary"]
        verdict = parsed_summary.get("verdict")
        attribution = parsed_summary.get("attribution") or {}
        dead_summary = parsed_summary.get("dead_code_summary") or {}
        if attribution:
            top_signal = (
                f"introduced dead-code={attribution.get('dead_code_introduced')}, "
                f"inherited dead-code={attribution.get('dead_code_inherited')}"
            )
        elif dead_summary:
            top_signal = f"dead-code total={dead_summary.get('total_issues')}"

    print(f"Fallow read-only run: exit_code={result.returncode}")
    print(f"Command: {' '.join(cmd)}")
    print(f"Adopted: {adoption['adopted']} configs={adoption['config_files']} package_hits={adoption['package_hits']}")
    if verdict:
        print(f"Verdict: {verdict}")
    print(f"Top signal: {top_signal}")
    print(f"Git status changed: {summary['git_status_changed']}")
    print(f"Fallow files changed: {summary['fallow_files_changed']}")
    print(f"Artifacts: {out_dir}")

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
