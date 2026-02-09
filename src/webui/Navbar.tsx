import { Component, Show } from "solid-js";
import { prefixStr, testsuiteName } from "./App";
import { displayFormat, DisplayFormat, setDisplayFormat, setUnitSize, unitSize, UnitSize } from "./DisplayFormat";
import { continueStep, nextStep, quitDebug, reverseStep, runNormal, runTestSuite, setWasmRuntime, singleStep, startStep, wasmRuntime } from "./EmulatorState";
import { doChangeTheme } from "./Theme";

export const Navbar: Component<{ textGetter: () => string }> = (props) => {
	return (
		<nav class="flex-none theme-gutter">
			<div class="mx-auto px-2">
				<div class="flex items-center h-10">
					<div class="flex-shrink-0">
						<h1 class="select-none text-xl font-bold theme-fg">ARES</h1>
					</div>
					<div class="flex-shrink-0 mx-auto"></div>
					<Show when={wasmRuntime.status == "debug" ? wasmRuntime : null}>{debugRuntime => <>
						<button
							on:click={() => singleStep(debugRuntime(), setWasmRuntime)}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Step into (${prefixStr}-S)`}
						>
							step_into
						</button>
						<button
							on:click={() => nextStep(debugRuntime(), setWasmRuntime)}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Step over/Next (${prefixStr}-N)`}
						>
							step_over
						</button>
						<button
							on:click={() => continueStep(debugRuntime(), setWasmRuntime)}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Continue (${prefixStr}-C)`}
						>
							resume
						</button>
						<button
							on:click={() => reverseStep(debugRuntime(), setWasmRuntime)}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Reverse step (${prefixStr}-Z)`}
						>
							undo
						</button>
						<button
							on:click={() => quitDebug(debugRuntime(), setWasmRuntime)}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Exit debugging (${prefixStr}-X)`}
						>
							stop
						</button>
						<div class="cursor-pointer flex-shrink-0 mx-auto"></div></>
					}
					</Show>
					<select
						class="font-semibold theme-fg theme-bg px-2 py-1 mx-1 focus:outline-none cursor-pointer"
						title="Memory unit size"
						value={unitSize()}
						onChange={(e) => setUnitSize(e.currentTarget.value as UnitSize)}
					>
						<option value="byte">byte</option>
						<option value="half">half</option>
						<option value="word">word</option>
					</select>
					<select
						class="font-semibold theme-fg theme-bg px-2 py-1 mx-1 focus:outline-none cursor-pointer"
						title="Number format"
						value={displayFormat()}
						onChange={(e) => setDisplayFormat(e.currentTarget.value as DisplayFormat)}
					>
						<option value="hex">hex</option>
						<option value="unsigned">unsigned</option>
						<option value="signed">signed</option>
					</select>
					<button
						on:click={doChangeTheme}
						class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
						title="Change theme"
					>
						dark_mode
					</button>
					<Show when={testsuiteName}>
						<button
							on:click={() => runTestSuite(wasmRuntime, setWasmRuntime, props.textGetter())}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Run tests (${prefixStr}-R)`}
						>
							play_circle
						</button>
					</Show>
					<Show when={!testsuiteName}>
						<button
							on:click={() => runNormal(wasmRuntime, setWasmRuntime, props.textGetter())}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Run (${prefixStr}-R)`}
						>
							play_circle
						</button>
						<button
							on:click={() => startStep(wasmRuntime, setWasmRuntime, props.textGetter())}
							class="cursor-pointer flex-0-shrink flex material-symbols-outlined theme-fg theme-bg-hover theme-bg-active"
							title={`Debug (${prefixStr}-D)`}
						>
							arrow_forward
						</button>
					</Show>
				</div>
			</div>
		</nav>
	);
};
