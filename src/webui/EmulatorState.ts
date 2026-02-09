import { createStore, SetStoreFunction } from "solid-js/store";
import { createSignal } from "solid-js";
import { wasmInterface } from ".";

export const TEXT_BASE = 0x00400000;
export const TEXT_END = 0x10000000;
export const DATA_BASE = 0x10000000;
export const STACK_TOP = 0x7FFFF000;
export const STACK_LEN = 4096;
export const DATA_END = 0x70000000;

export function toUnsigned(x: number): number {
	return x >>> 0;
}

function buildShadowStack() {
	let len = wasmInterface.shadowStackLen[0];
	let st: { name: string, args: number[], sp: number }[] = new Array(len);
	let shadowStack = wasmInterface.getShadowStack();
	for (let i = 0; i < wasmInterface.shadowStackLen[0]; i++) {
		let pc = shadowStack[i * (96 / 4) + 0];
		let sp = shadowStack[i * (96 / 4) + 1];
		let args = shadowStack.slice(i * (96 / 4) + 2).slice(0, 8);
		st[i] = { name: wasmInterface.getStringFromPc(pc), args: [...args], sp: sp };
	}
	return st;
}


export function convertNumber(x: number, decimal: boolean): string {
	let ptr = false;
	if (decimal) {
		if (x >= TEXT_BASE && x <= TEXT_END) ptr = true;
		else if (x >= STACK_TOP - STACK_LEN && x <= STACK_TOP) ptr = true;
		else if (x >= DATA_BASE && x <= DATA_END) ptr = true;
		if (ptr) return "0x" + (toUnsigned(x).toString(16).padStart(8, "0"));
		else return toUnsigned(x).toString();
	} else {
		return toUnsigned(x).toString(16).padStart(8, "0");
	}
}

let globalVersion = 1;

export type ShadowEntry = { name: string; args: number[]; sp: number };

export type IdleState = {
	status: "idle";
	version: number;
};

export type RunningState = {
	status: "running";
	consoleText: string;
	pc: number;
	regs: number[];
	version: number;
};

export type DebugState = {
	status: "debug";
	consoleText: string;
	pc: number;
	regs: number[];
	shadowStack: ShadowEntry[];
	memWrittenAddr: number;
	memWrittenLen: number;
	version: number;
};

export type ErrorState = {
	status: "error";
	consoleText: string;
	pc: number;
	regs: number[];
	shadowStack: ShadowEntry[];
	version: number;
};

export type StoppedState = {
	status: "stopped";
	consoleText: string;
	pc: number;
	regs: number[];
	version: number;
};

export type AsmErrState = {
	status: "asmerr";
	consoleText: string;
	line: number;
	message: string;
	version: number;
};

export type TestSuiteTableEntry = {
	input: string,
	userOutput: string
	output: string,
	runErr: boolean
};

export type TestSuiteState = {
	status: "testsuite";
	table: TestSuiteTableEntry[];
	version: number;
};

export type RuntimeState =
	| IdleState
	| RunningState
	| DebugState
	| ErrorState
	| StoppedState
	| AsmErrState
	| TestSuiteState;

export type TestData = {
	assignment: string,
	testPrefix: string,
	testcases: { input: string, output: string }[]
};

export let testData: TestData | null;

export const initialRegs = new Array(31).fill(0);
export let [wasmRuntime, setWasmRuntime] = createStore<RuntimeState>({ status: "idle", version: 0 });

export let latestAsm = { text: "" };

let breakpoints = new Set();
export let breakpointLines: number[] = [];

// TODO: i'm pretty sure i can merge those two
export function setBreakpointLines(l: any[]): void {
	breakpointLines = l;
}

function setBreakpoints(): void {
	breakpoints = new Set();
	for (let lineNum of breakpointLines) {
		for (let i = 0; i < 65536; i++) {
			// FIXME: make safe
			if (wasmInterface.textByLinenum![i] == lineNum) {
				breakpoints.add(TEXT_BASE + i * 4);
			}
		}
	}
}

export function doBuildForLinter(text: string): boolean {
	if (wasmRuntime.status != "idle" && wasmRuntime.status != "stopped" && wasmRuntime.status != "asmerr") return false;
	if (latestAsm["text"] != text) {
		if (testData == null) buildAsm(wasmRuntime, setWasmRuntime, text);
		else {
			let testcases = testData.testcases;
			let testPrefix = testData.testPrefix;
			buildWithTestcase(wasmRuntime, setWasmRuntime, testPrefix + testcases[0].input, text);
		}
	}
	return true;
}

function updateReactiveState(setRuntime: SetStoreFunction<RuntimeState>) {
	if (wasmInterface.hasError) {
		const st = buildShadowStack();
		setRuntime({
			status: "error",
			consoleText: wasmInterface.textBuffer,
			pc: wasmInterface.pc?.[0] ?? 0,
			regs: [...wasmInterface.regsArr?.slice(0, 31) ?? initialRegs],
			shadowStack: st,
			version: globalVersion++
		});
	} else if (wasmInterface.successfulExecution) {
		setRuntime({
			status: "stopped",
			consoleText: wasmInterface.textBuffer,
			pc: wasmInterface.pc?.[0] ?? 0,
			regs: [...wasmInterface.regsArr?.slice(0, 31) ?? initialRegs],
			version: globalVersion++
		});
	} else {
		setRuntime({
			status: "debug",
			consoleText: wasmInterface.textBuffer,
			pc: wasmInterface.pc?.[0] ?? 0,
			regs: [...wasmInterface.regsArr?.slice(0, 31) ?? initialRegs],
			shadowStack: buildShadowStack(),
			version: globalVersion++,
			memWrittenAddr: wasmInterface.memWrittenAddr[0],
			memWrittenLen: wasmInterface.memWrittenLen[0],
		});
	}
}

export function buildAsm(_runtime: RuntimeState, setRuntime: SetStoreFunction<RuntimeState>, asm: string): void {
	const err = wasmInterface.build(asm);
	if (err !== null) {
		setRuntime({
			status: "asmerr",
			consoleText: `Error on line ${err.line}: ${err.message}`,
			line: err.line,
			message: err.message,
			version: globalVersion++
		});
	} else {
		if (_runtime.status != "stopped" || asm != latestAsm.text) setRuntime({ status: "idle", version: globalVersion++ });
	}
	latestAsm.text = asm;
}

export function runNormal(_runtime: RuntimeState, setRuntime: SetStoreFunction<RuntimeState>, asm: string): void {
	buildAsm(_runtime, setRuntime, asm);
	if (_runtime.status == "asmerr") return;
	setRuntime({
		status: "running",
		consoleText: "",
		pc: wasmInterface.pc?.[0] ?? TEXT_BASE,
		regs: [...wasmInterface.regsArr?.slice(0, 31) ?? initialRegs],
	});

	// run loop
	while (true) {
		wasmInterface.run();
		if (wasmInterface.successfulExecution || wasmInterface.hasError) break;
	}
	if (wasmInterface.successfulExecution) {
		const needsNewline =
			wasmInterface.textBuffer.length &&
			wasmInterface.textBuffer[wasmInterface.textBuffer.length - 1] != "\n";

		wasmInterface.textBuffer +=
			needsNewline
				? "\nExecuted successfully."
				: "Executed successfully.";
	}
	updateReactiveState(setRuntime);
}


export function buildWithTestcase(_runtime: RuntimeState, setRuntime: SetStoreFunction<RuntimeState>, suffix: string, asm_: string): void {
	// add trailing newline to ensure that testcases assemble properly
	const asm = asm_ + "\n";
	const err = wasmInterface.build(asm + suffix);
	if (err !== null) {
		setRuntime({
			status: "asmerr",
			consoleText: `Error on line ${err.line}: ${err.message}`,
			line: err.line,
			message: err.message,
			version: globalVersion++
		});
	} else {
		if (_runtime.status != "stopped" || asm != latestAsm.text) setRuntime({ status: "idle", version: globalVersion++ });
	}
	latestAsm.text = asm;
}

export let [wasmTestsuite, setTestsuite] = createSignal<TestSuiteTableEntry[]>([]);
export let [wasmTestsuiteIdx, setTestsuiteIdx] = createSignal<number>(-1);

export function runTestSuite(_runtime: RuntimeState, setRuntime: SetStoreFunction<RuntimeState>, asm: string): void {
	if (testData == null) return;
	let testcases = testData.testcases;
	let testPrefix = testData.testPrefix;
	let outputTable = [];
	for (let i = 0; i < testcases.length; i++) {
		console.log("running test case", i);
		buildWithTestcase(_runtime, setRuntime, testPrefix + testcases[i].input, asm);
		if (_runtime.status == "asmerr") return;
		setRuntime({
			status: "running",
			consoleText: "",
			pc: wasmInterface.pc?.[0] ?? TEXT_BASE,
			regs: [...wasmInterface.regsArr?.slice(0, 31) ?? initialRegs],
		});

		// run loop
		while (true) {
			wasmInterface.run();
			if (wasmInterface.successfulExecution || wasmInterface.hasError) break;
		}
		if (wasmInterface.successfulExecution && _runtime.status == "running") {
			outputTable.push({ ...testcases[i], runErr: false, userOutput: wasmInterface.textBuffer.trim() });
		} else {
			outputTable.push({ ...testcases[i], runErr: true, userOutput: wasmInterface.textBuffer.trim() });
		}
	}
	setTestsuite(outputTable);
}



export function startStep(_runtime: RuntimeState, setRuntime: SetStoreFunction<RuntimeState>, asm: string): void {
	buildAsm(_runtime, setRuntime, asm);
	if (_runtime.status == "asmerr") return;

	setRuntime({
		status: "debug",
		consoleText: "",
		pc: wasmInterface.pc?.[0],
		regs: initialRegs,
		shadowStack: [],
	});
}

function countLines(str: string | any[]) {
	let count = 0;
	for (let i = 0; i < str.length; i++) {
		if (str[i] === '\n') count++;
	}
	return count;
}

export function startStepTestSuite(_runtime: RuntimeState, setRuntime: SetStoreFunction<RuntimeState>, index: number, asm: string): void {
	setTestsuiteIdx(index);
	if (testData == null) return;
	let testcases = testData.testcases;
	let testPrefix = testData.testPrefix;

	let suffix = testPrefix + testcases[index].input;

	buildWithTestcase(_runtime, setRuntime, suffix, asm);
	setRuntime({
		status: "debug",
		consoleText: "",
		pc: wasmInterface.pc?.[0],
		regs: initialRegs,
		shadowStack: [],
	});

	// run instructions until you hit user code
	let lines = countLines(asm);
	while (true) {
		wasmInterface.run();
		let linenoIdx = (wasmInterface.pc[0] - TEXT_BASE) / 4;
		if (linenoIdx < wasmInterface.textByLinenumLen![0]) {
			if (wasmInterface.textByLinenum![linenoIdx] < lines) break;
		}

	}
	updateReactiveState(setRuntime);
}


export function singleStep(_runtime: DebugState, setRuntime: SetStoreFunction<RuntimeState>): void {
	setBreakpoints();
	wasmInterface.run();
	updateReactiveState(setRuntime);
}

let temporaryBreakpoint: number | null = null;
let savedSp = 0;

export function continueStep(_runtime: DebugState, setRuntime: SetStoreFunction<RuntimeState>): void {
	setBreakpoints();
	while (true) {
		wasmInterface.run();
		if (temporaryBreakpoint === wasmInterface.pc[0] && savedSp === wasmInterface.regsArr[2 - 1]) {
			temporaryBreakpoint = null;
			break;
		}
		if (breakpoints.has(wasmInterface.pc[0])) break;
		if (wasmInterface.successfulExecution || wasmInterface.hasError) break;
	}
	if (wasmInterface.successfulExecution) {
		const needsNewline =
			wasmInterface.textBuffer.length &&
			wasmInterface.textBuffer[wasmInterface.textBuffer.length - 1] != "\n";

		wasmInterface.textBuffer +=
			needsNewline
				? "\nExecuted successfully."
				: "Executed successfully.";
	}
	updateReactiveState(setRuntime);
}

export function nextStep(_runtime: DebugState, setRuntime: SetStoreFunction<RuntimeState>): void {
	const inst = wasmInterface.emu_load(wasmInterface.pc[0], 4);
	const opcode = inst & 127;
	const funct3 = (inst >> 12) & 7;
	const rd = (inst >> 7) & 31;
	const isJal = opcode === 0x6f;
	const isJalr = opcode === 0x67 && funct3 === 0;
	if ((isJal || isJalr) && rd === 1) {
		temporaryBreakpoint = wasmInterface.pc[0] + 4;
		savedSp = wasmInterface.regsArr[2 - 1];
		continueStep(_runtime, setRuntime);
	} else {
		singleStep(_runtime, setRuntime);
	}
}

export function quitDebug(_runtime: DebugState, setRuntime: SetStoreFunction<RuntimeState>): void {
	setRuntime({ status: "idle", version: globalVersion++ });
}

export function reverseStep(_runtime: DebugState, setRuntime: SetStoreFunction<RuntimeState>): void {
	if (wasmInterface.numOfExecutedInstructions > 0) {
		// i want to use the current memWrittenAddr and len
		// so it shows the reverse diff
		const oldAddr = wasmInterface.memWrittenAddr[0];
		const oldLen = wasmInterface.memWrittenLen[0];
		wasmInterface.reverseStep();
		setRuntime({
			status: "debug",
			consoleText: wasmInterface.textBuffer,
			pc: wasmInterface.pc?.[0] ?? 0,
			regs: [...wasmInterface.regsArr?.slice(0, 31) ?? initialRegs],
			shadowStack: buildShadowStack(),
			version: globalVersion++,
			memWrittenAddr: oldAddr,
			memWrittenLen: oldLen,
		});
	}
}

// in accordance to CodeMirror, 0 = invalid line (PC out of the file)
export function getCurrentLine(_runtime: DebugState | ErrorState): number {
	let linenoIdx = (_runtime.pc - TEXT_BASE) / 4;
	// FIXME: make safe
	if (linenoIdx < wasmInterface.textByLinenumLen![0])
		return wasmInterface.textByLinenum![linenoIdx];
	return 0;
}

export function consoleText(_runtime: IdleState | RunningState | DebugState | ErrorState | StoppedState | AsmErrState | TestSuiteState): string {
	if (_runtime.status == "idle" || _runtime.status == "testsuite") return "";
	return _runtime.consoleText;
}

export type ShadowStackAugmentedEnt = {
	name: string,
	elems: { addr: string, isAnimated: boolean, text: string }[]
}

// TODO: cleanup and make type safe
export function shadowStackAugmented(shadowStack: ShadowEntry[], load: (addr: number, pow: number) => number, writeAddr: number, writeLen: number): ShadowStackAugmentedEnt[] {
	let allInfo = new Array(shadowStack.length);
	for (let i = 0; i < shadowStack.length; i++) {
		let ent = shadowStack[i];
		let startSp = i == (shadowStack.length - 1) ? wasmInterface.regsArr[2 - 1] : shadowStack[i + 1].sp;
		let elemCnt = (ent.sp - startSp) / 4;
		let elems = new Array(elemCnt);
		for (let j = 0, ptr = ent.sp - 4; j < elemCnt; j++, ptr -= 4) {
			let text = load ? convertNumber(load(ptr, 4), true) : "0";
			if (wasmInterface.callsanWrittenBy) {
				let off = (ptr - (0x7FFFF000 - 4096)) / 4;
				let regidx = wasmInterface.callsanWrittenBy[off];
				if (regidx == 0xff) text = "??";
				else if (regidx != 0) text += " (" + wasmInterface.getRegisterName(regidx) + ")";
			}
			let isAnimated = ptr >= writeAddr && ptr < writeAddr + writeLen;
			elems[j] = { addr: ptr.toString(16), isAnimated, text };
		}
		allInfo[shadowStack.length - 1 - i] = { name: ent.name, elems };
	}
	return allInfo;
}

export async function fetchTestcases() {
	const urlParams = new URLSearchParams(window.location.search);
	const testsuiteName = urlParams.get('testsuite');
	if (!testsuiteName) return;
	let asmP = fetch(testsuiteName + ".S");
	let jsonP = fetch(testsuiteName + ".json");
	let assignmentP = fetch(testsuiteName + ".txt");

	const [asmRes, jsonRes, assignmentRes] = await Promise.all([asmP, jsonP, assignmentP]);

	if (!asmRes.ok || !jsonRes.ok || !assignmentRes.ok) {
		alert("Can't load testcase files");
		return;
	}
	const testPrefix = await asmRes.text();
	const testcases = await jsonRes.json();
	const assignment = (await assignmentRes.text()).trim();

	testData = { assignment, testPrefix, testcases };
}