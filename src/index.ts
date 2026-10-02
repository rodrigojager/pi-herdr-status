import { execFile } from "node:child_process";
import type { ExtensionAPI, ExtensionContext, ExtensionUIContext } from "@earendil-works/pi-coding-agent";

/**
 * FIFO queue for herdr CLI invocations. Concurrent `execFile` calls are separate
 * processes with no ordering guarantee, so a `clear-token` racing a later
 * `report-metadata` could land last and delete model_info. Serializing keeps
 * updates in the order they were issued.
 */
let metadataQueue: Promise<void> = Promise.resolve();

let execFileImpl: typeof execFile = execFile;

/**
 * Test hook: replace the herdr CLI exec function to observe invocations.
 * Resets the metadata queue so tests start from a clean slate.
 */
export function _setExecFileImplForTest(fn?: typeof execFile): void {
	execFileImpl = fn ?? execFile;
	metadataQueue = Promise.resolve();
}

/** Test hook: waits until all queued Herdr CLI invocations complete. */
export function _waitForMetadataQueueForTest(): Promise<void> {
	return metadataQueue;
}

/** Runs a herdr CLI invocation serially (FIFO). */
function runHerdrSerially(args: string[]): void {
	metadataQueue = metadataQueue.then(
		() =>
			new Promise<void>((resolve) => {
				execFileImpl("herdr", args, { timeout: 2000, windowsHide: true, maxBuffer: 65536 }, () => resolve());
			}),
	);
}

/**
 * ExtensionAPI type extension for getThinkingLevel if missing in base types.
 */
type ExtendedExtensionAPI = ExtensionAPI & {
	getThinkingLevel?: () => string;
};

/**
 * Default source namespace to prevent collisions with other Herdr plugins (e.g., gh-pr).
 */
export const DEFAULT_SOURCE = "pi-model";
export const DEFAULT_TOKEN_NAME = "model_info";

/**
 * Checks if the current context or process is running as a subagent.
 */
export function isSubagent(ctx?: ExtensionContext): boolean {
	if (
		process.env.PI_SUBAGENT === "true" ||
		process.env.PI_SUBAGENT === "1" ||
		process.env.PI_IS_SUBAGENT === "true" ||
		process.env.PI_IS_SUBAGENT === "1" ||
		process.env.SUBAGENT === "true" ||
		process.env.SUBAGENT === "1"
	) {
		return true;
	}

	if (ctx?.sessionManager) {
		const header = ctx.sessionManager.getHeader();
		if (header && "parentSession" in header && Boolean(header.parentSession)) {
			return true;
		}
		// pi-subagents creates subagent sessions in-memory by default, and those
		// have no parentSession in the header. The top-level persisted session
		// always has a session file, so its absence means we are not the main
		// session (or pi runs ephemeral, in which case reporting is skipped).
		// Call as a method: SessionManager#getSessionFile reads `this.sessionFile`,
		// so detaching it would lose the receiver and throw.
		if (
			typeof ctx.sessionManager.getSessionFile !== "function" ||
			!ctx.sessionManager.getSessionFile()
		) {
			return true;
		}
	}

	return false;
}

/**
 * Agent lifecycle state recognized by Herdr CLI.
 */
export type HerdrAgentState = "idle" | "working" | "blocked" | "unknown";

/**
 * Safely reports metadata token to Herdr sidebar agents panel via `herdr` CLI.
 */
export function reportMetadata(
	statusText: string,
	paneId?: string,
	tokenName = DEFAULT_TOKEN_NAME,
	source = DEFAULT_SOURCE,
): void {
	const args = ["pane", "report-metadata"];
	if (paneId) {
		args.push(paneId);
	}
	args.push("--source", source, "--agent", "pi", "--applies-to-source", "herdr:pi", "--token", `${tokenName}=${statusText}`);

	runHerdrSerially(args);
}

/**
 * Clears model_info token metadata from Herdr sidebar.
 */
export function clearMetadata(
	paneId?: string,
	tokenName = DEFAULT_TOKEN_NAME,
	source = DEFAULT_SOURCE,
): void {
	const args = ["pane", "report-metadata"];
	if (paneId) {
		args.push(paneId);
	}
	args.push("--source", source, "--agent", "pi", "--applies-to-source", "herdr:pi", "--clear-token", tokenName);

	runHerdrSerially(args);
}

/**
 * Reports agent lifecycle state (e.g. working, blocked/waiting confirmation, idle) to Herdr.
 */
export function reportAgentState(
	state: HerdrAgentState,
	message?: string,
	agentLabel = "pi",
	paneId?: string,
	source = DEFAULT_SOURCE,
): void {
	const args = ["pane", "report-agent"];
	if (paneId) {
		args.push(paneId);
	}
	args.push("--source", source, "--agent", agentLabel || "pi", "--state", state);
	if (message) {
		args.push("--message", message);
	}

	runHerdrSerially(args);
}

/** Extension UI contexts already intercepted by this module instance. */
const patchedUIs = new WeakSet<ExtensionUIContext>();

/** Intercepts dialogs so callers can track when user interaction starts and ends. */
export function patchUI(
	ui: ExtensionUIContext,
	onDialogOpen: (title: string) => void,
	onDialogClose: () => void,
): void {
	if (patchedUIs.has(ui)) return;
	patchedUIs.add(ui);

	const wrapDialog = <TArgs extends unknown[], TResult>(
		dialog: (...args: TArgs) => Promise<TResult>,
	) => async (...args: TArgs): Promise<TResult> => {
		const title = typeof args[0] === "string" ? args[0] : "";
		onDialogOpen(title);
		try {
			return await dialog(...args);
		} finally {
			onDialogClose();
		}
	};

	ui.confirm = wrapDialog(ui.confirm.bind(ui));
	ui.select = wrapDialog(ui.select.bind(ui));
	ui.input = wrapDialog(ui.input.bind(ui));
	ui.editor = wrapDialog(ui.editor.bind(ui));
}

/**
 * Formats a model object and optional thinking level into a concise display label.
 * Provider prefix is stripped when present.
 * Example: "claude-3-7-sonnet (high)" or "claude-3-7-sonnet"
 */
export function formatModelLabel(
	model?: {
		provider?: string;
		id?: string;
		name?: string;
	},
	thinkingLevel?: string,
): string {
	if (!model) return "";
	let baseLabel = "";
	if (model.id) {
		// Strip "provider/" prefix when the id embeds it
		baseLabel = model.provider && model.id.startsWith(`${model.provider}/`)
			? model.id.slice(model.provider.length + 1)
			: model.id;
	} else {
		baseLabel = model.name || "";
	}

	if (!baseLabel) return "";

	if (thinkingLevel && thinkingLevel !== "off") {
		return `${baseLabel} (${thinkingLevel})`;
	}
	return baseLabel;
}

/** The official Herdr integration remains the sole lifecycle/status reporter. */
export default function (pi: ExtensionAPI): void {
  const paneId = process.env.HERDR_PANE_ID;
  if (!paneId || isSubagent()) return;
  const update = (_event: unknown, ctx: ExtensionContext) => {
    if (!ctx.hasUI || isSubagent(ctx)) return;
    const label = formatModelLabel(ctx.model, ctx.thinkingLevel ?? pi.getThinkingLevel());
    if (label) reportMetadata(label, paneId);
    else clearMetadata(paneId);
  };
  pi.on("session_start", update);
  pi.on("model_select", update);
  pi.on("thinking_level_select", update);
  pi.on("before_agent_start", update);
  pi.on("session_shutdown", (event, ctx) => {
    if (event.reason === "quit" && ctx.hasUI && !isSubagent(ctx)) clearMetadata(paneId);
  });
}
