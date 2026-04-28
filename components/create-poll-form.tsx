"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/app/wallet-context";
import { useCreatePoll } from "@/hooks/use-create-poll";
import { toError, UserRejectedError } from "@/lib/errors";

const EXPLORER = "https://stellar.expert/explorer/testnet/tx";

type WindowPreset = { label: string; secs: number };

const PRESETS: WindowPreset[] = [
  { label: "5 min", secs: 5 * 60 },
  { label: "1 hr", secs: 60 * 60 },
  { label: "1 day", secs: 24 * 60 * 60 },
];

type Unit = "sec" | "min" | "hr" | "day";
const UNIT_SECS: Record<Unit, number> = {
  sec: 1,
  min: 60,
  hr: 60 * 60,
  day: 24 * 60 * 60,
};
const UNIT_LABEL: Record<Unit, string> = {
  sec: "seconds",
  min: "minutes",
  hr: "hours",
  day: "days",
};

const QUESTION_MAX = 200;
const OPTION_MAX = 60;

export function CreatePollForm() {
  const { address } = useWallet();
  const qc = useQueryClient();
  const create = useCreatePoll(address);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [preset, setPreset] = useState<number | "custom">(PRESETS[0].secs);
  const [customAmount, setCustomAmount] = useState("60");
  const [customUnit, setCustomUnit] = useState<Unit>("sec");

  if (!address) return null;

  const trimmedQ = question.trim();
  const trimmedOpts = options.map((o) => o.trim());
  const filledOpts = trimmedOpts.filter((o) => o.length > 0);
  const hasDupes = new Set(filledOpts).size !== filledOpts.length;
  const allFilled = trimmedOpts.every((o) => o.length > 0);

  const windowSecs =
    preset === "custom"
      ? Math.max(1, parseInt(customAmount || "0", 10)) * UNIT_SECS[customUnit]
      : preset;

  const validation = (() => {
    if (trimmedQ.length === 0) return "Question is required.";
    if (options.length < 2) return "At least 2 options.";
    if (options.length > 6) return "At most 6 options.";
    if (!allFilled) return "Every option needs a label.";
    if (hasDupes) return "Option labels must be unique.";
    if (windowSecs < 1) return "Voting window must be at least 1 second.";
    return null;
  })();

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((p, j) => (j === i ? value : p)));
  }
  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, j) => j !== i));
  }

  function reset() {
    setQuestion("");
    setOptions(["", ""]);
    setPreset(PRESETS[0].secs);
    setCustomAmount("60");
    setCustomUnit("sec");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (validation) return;
    try {
      await create.mutateAsync({
        question: trimmedQ,
        options: trimmedOpts,
        windowSecs,
      });
      qc.invalidateQueries({ queryKey: ["poll-count"] });
      qc.invalidateQueries({ queryKey: ["polls"] });
      qc.invalidateQueries({ queryKey: ["events"] });
      reset();
      setOpen(false);
    } catch (e) {
      console.error("[create-poll] failed:", e);
      // surfaced via create.error in the UI
    }
  }

  const err = create.error ? toError(create.error) : null;

  if (!open) {
    // Twitter-style composer: a fake input field that expands the form.
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-base text-accent-bright">
          +
        </span>
        <span className="flex-1 text-sm text-subtle">
          Start a new poll...
        </span>
        <span className="hidden text-[10px] uppercase tracking-[0.18em] text-subtle sm:inline">
          New
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass-strong space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-accent-bright/80">
          New Poll
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-subtle hover:text-fg"
        >
          Cancel
        </button>
      </div>

      <div>
        <input
          type="text"
          placeholder="What should we vote on?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={QUESTION_MAX}
          className="glass-input w-full px-3 py-2.5 text-sm"
          autoFocus
        />
        <div className="mt-1 flex justify-end text-[10px] text-subtle">
          {trimmedQ.length}/{QUESTION_MAX}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-subtle">
            Options ({options.length}/6)
          </div>
          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= 6}
            className="text-[11px] text-accent-bright hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add option
          </button>
        </div>
        <div className="space-y-2">
          {options.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent-bright">
                {String.fromCharCode(65 + i)}
              </span>
              <input
                type="text"
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                value={value}
                onChange={(e) => setOption(i, e.target.value)}
                maxLength={OPTION_MAX}
                className="glass-input flex-1 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={options.length <= 2}
                className="text-[11px] text-subtle hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                aria-label={`Remove option ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] uppercase tracking-wide text-subtle">
          Voting Window
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setPreset(w.secs)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                preset === w.secs
                  ? "border-accent/60 bg-accent/20 text-accent-bright"
                  : "border-border bg-white/5 text-muted hover:border-border-strong"
              }`}
            >
              {w.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              preset === "custom"
                ? "border-accent/60 bg-accent/20 text-accent-bright"
                : "border-border bg-white/5 text-muted hover:border-border-strong"
            }`}
          >
            Custom
          </button>
        </div>
        {preset === "custom" && (
          <div className="mt-2 space-y-2">
            <div className="flex items-stretch gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="glass-input w-28 px-3 py-1.5 font-mono text-sm"
              />
              <div className="flex gap-1 rounded-md border border-border bg-white/5 p-0.5">
                {(["sec", "min", "hr", "day"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setCustomUnit(u)}
                    className={`rounded px-2.5 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
                      customUnit === u
                        ? "bg-accent/30 text-accent-bright"
                        : "text-subtle hover:text-fg"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-subtle">
              ≈ {windowSecs.toLocaleString()} {UNIT_LABEL.sec}
              {windowSecs >= 60 && (
                <>
                  {" "}
                  (
                  {windowSecs >= 86400
                    ? `${(windowSecs / 86400).toFixed(2)} ${UNIT_LABEL.day}`
                    : windowSecs >= 3600
                      ? `${(windowSecs / 3600).toFixed(2)} ${UNIT_LABEL.hr}`
                      : `${(windowSecs / 60).toFixed(2)} ${UNIT_LABEL.min}`}
                  )
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-muted">
        Vote weight equals the integer square root of staked stroops, so
        doubling stake gives roughly 1.41x more voice.
      </div>

      {validation && trimmedQ.length > 0 && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-2.5 text-xs text-amber-200">
          {validation}
        </div>
      )}

      <button
        type="submit"
        disabled={create.isPending || !!validation}
        className="btn-primary w-full px-4 py-2.5 text-sm font-medium"
      >
        {create.isPending ? "Submitting..." : "Create Poll"}
      </button>

      {create.isSuccess && create.data && (
        <a
          href={`${EXPLORER}/${create.data.hash}`}
          target="_blank"
          rel="noreferrer"
          className="block break-all rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success hover:bg-success/15"
        >
          Poll created: {create.data.hash.slice(0, 16)}...
        </a>
      )}

      {err && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
          {err instanceof UserRejectedError
            ? "You rejected the request in your wallet."
            : `Failed: ${err.message}`}
        </div>
      )}
    </form>
  );
}
