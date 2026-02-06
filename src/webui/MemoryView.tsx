import { createVirtualizer } from "@tanstack/solid-virtual";
import { Component, createSignal, onMount, createEffect, For, Show } from "solid-js";
import { TabSelector } from "./TabSelector";
import { DATA_BASE, shadowStackAugmented, ShadowStackAugmentedEnt, STACK_LEN, STACK_TOP, TEXT_BASE, toUnsigned, wasmRuntime } from "./EmulatorState";
import { Portal } from "solid-js/web";

const ROW_HEIGHT: number = 24;

export const MemoryView: Component<{ version: () => any, writeAddr: number, writeLen: number, sp: number, load: (addr: number, pow: number) => number | null }> = (props) => {
    let parentRef: HTMLDivElement | undefined;
    let dummyChar: HTMLDivElement | undefined;

    const [containerWidth, setContainerWidth] = createSignal<number>(0);
    const [chunkWidth, setChunkWidth] = createSignal<number>(0);
    const [chunksPerLine, setChunksPerLine] = createSignal<number>(1);
    const [lineCount, setLineCount] = createSignal<number>(0);
    const [addrSelect, setAddrSelect] = createSignal<number>(-1);
    const [hoveredNumber, setHoveredNumber] = createSignal<number | null>(null);
    const [mousePos, setMousePos] = createSignal<{ x: number, y: number }>({ x: 0, y: 0 });
    const [unitSize, setUnitSize] = createSignal<"byte" | "half" | "word">("byte");

    const getUnitBytes = () => unitSize() === "byte" ? 1 : unitSize() === "half" ? 2 : 4;

    onMount(() => {
        if (dummyChar) {
            setChunkWidth(dummyChar.getBoundingClientRect().width * (8 + 2.5));
        }
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        if (parentRef) ro.observe(parentRef);
        return () => ro.disconnect();
    });

    // FIXME: query size instead of hardcoding 64k
    createEffect(() => {
        const cw = chunkWidth();
        const cWidth = containerWidth();
        if (cw > 0 && cWidth > 0) {
            const count = Math.floor(cWidth / cw);
            setChunksPerLine(count);
            if (count < 2) setLineCount(65536 / 4 + 1);
            else setLineCount(Math.ceil(65536 / 4 / (count - 1)));
        }
    });

    const rowVirtualizer = createVirtualizer({
        get count() {
            return lineCount();
        },
        getScrollElement: () => parentRef ?? null,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5,
    });

    const [activeTab, setActiveTab] = createSignal(".text");

    // stack starts at the end, others at the start
    createEffect(() => {
        if (parentRef) {
            if (activeTab() == "stack") {
                const lastIndex = lineCount() - 1;
                rowVirtualizer.scrollToIndex(lastIndex);
            } else {
                rowVirtualizer.scrollToIndex(0);
            }
        }
    });

    const getStartAddr = () => {
        if (activeTab() == ".text") return TEXT_BASE;
        else if (activeTab() == ".data") return DATA_BASE;
        else if (activeTab() == "stack") return STACK_TOP - 65536; // TODO: runtime stack size detection
        return 0;
    };

    // FIXME: selecting data should not also select the address column
    return (
        <div class="h-full flex flex-col" style={{ contain: "strict" }} onMouseDown={() => setAddrSelect(-1)}>
            <TabSelector tab={activeTab()} setTab={setActiveTab} tabs={[".text", ".data", "stack", "frames"]} />
            <Portal mount={document.body}>
                <Show when={hoveredNumber() !== null}>

                    <div
                        class="absolute theme-fg theme-gutter text-xs px-1 py-0.5 pointer-events-none z-50"
                        style={{
                            top: `${mousePos().y + 3}px`,
                            left: `${mousePos().x + 3}px`,
                            position: "fixed"
                        }}
                    >
                        {(() => {
                            let num = hoveredNumber();
                            let text = String(num);
                            if (unitSize() == "byte" && num >= 32 && num <= 126) text += " (" + String.fromCharCode(num) + ")";
                            return text;
                        })()}
                    </div>
                </Show>
            </Portal>
            <div class="flex gap-2 px-2 py-1">
                <select class="font-semibold theme-fg theme-bg px-1 py-1 focus:outline-none " value={unitSize()} onChange={(e) => setUnitSize(e.currentTarget.value as any)}>
                    <option value="byte">byte</option>
                    <option value="half">half</option>
                    <option value="word">word</option>
                </select>
            </div>

            <div ref={parentRef} class="font-mono text-lg overflow-auto theme-scrollbar ml-2">
                <div ref={dummyChar} class="invisible absolute ">{"0"}</div>

                <Show when={activeTab() == "frames"}>
                    <ShadowStack
                        shadowStackAugmented={(wasmRuntime.status == "debug" || wasmRuntime.status == "error")
                            ? shadowStackAugmented(wasmRuntime.shadowStack, props.load, props.writeAddr, props.writeLen) : []}
                        version={props.version} />
                </Show>

                <Show when={activeTab() != "frames"}>
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
                        <For each={rowVirtualizer.getVirtualItems()}>
                            {(virtRow) => (
                                <div style={{ position: "absolute", top: `${virtRow.start}px`, width: "100%" }}>
                                    <Show when={chunksPerLine() > 1}>
                                        <a
                                            class={"theme-fg2 pr-2 " + ((addrSelect() == virtRow.index) ? "select-text" : "select-none")}
                                            onMouseDown={(e) => { setAddrSelect(virtRow.index); e.stopPropagation(); }}>
                                            {(getStartAddr() + virtRow.index * (chunksPerLine() - 1) * 4).toString(16).padStart(8, "0")}
                                        </a>
                                    </Show>

                                    {(() => {
                                        props.version();
                                        let start = getStartAddr();
                                        let chunks = chunksPerLine() - 1;
                                        let idx = virtRow.index;
                                        if (chunksPerLine() < 2) chunks = 1;

                                        const bytesPerUnit = getUnitBytes();

                                        let components = new Array(chunks * 4);
                                        let select = (addrSelect() == -1) ? "select-text" : "select-none";

                                        for (let i = 0; i < chunks; i++) {
                                            if (bytesPerUnit == 1) {
                                                const units = Math.floor((chunks * 4) / bytesPerUnit);
                                                for (let j = 0; j < 4; j++) {
                                                    let style = select;
                                                    let ptr = start + (idx * chunks + i) * 4 + j;
                                                    if ((idx * chunks + i) * 4 + j >= 65536) break;
                                                    let isAnimated = ptr >= props.writeAddr && ptr < props.writeAddr + props.writeLen;
                                                    let grayedOut = activeTab() == "stack" && ptr < props.sp;
                                                    if (grayedOut) style = "theme-fg2";
                                                    if (ptr >= props.sp && ptr < props.sp + 4) style = "frame-highlight";
                                                    if (isAnimated) style = "animate-fade-highlight";
                                                    let text = props.load ? props.load(ptr, 1).toString(16).padStart(2, "0") : "00";
                                                    style += (j != 3) ? " mr-[0.5ch]" : " mr-[1ch]";
                                                    components[i * 4 + j] = <a
                                                        class={style}
                                                        onMouseEnter={(e) => {
                                                            if (props.load) setHoveredNumber(props.load(ptr, 1));
                                                            setMousePos({ x: e.clientX, y: e.clientY });
                                                        }}
                                                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                                        onMouseLeave={() => setHoveredNumber(null)}
                                                    >
                                                        {text}
                                                    </a>
                                                }
                                            } else if (bytesPerUnit == 2) {
                                                for (let j = 0; j < 2; j++) {
                                                    let style = select;
                                                    let ptr = start + (idx * chunks + i) * 4 + j * 2;
                                                    if ((idx * chunks + i) * 4 + j * 2 >= 65536) break;
                                                    let isAnimated = ptr >= props.writeAddr && ptr < props.writeAddr + props.writeLen;
                                                    let grayedOut = activeTab() == "stack" && ptr < props.sp;
                                                    if (grayedOut) style = "theme-fg2";
                                                    if (ptr >= props.sp && ptr < props.sp + 4) style = "frame-highlight";
                                                    if (isAnimated) style = "animate-fade-highlight";
                                                    let text = props.load ? props.load(ptr, 2).toString(16).padStart(4, "0") : "0000";
                                                    style += (j != 1) ? " mr-[1ch]" : " mr-[1.5ch]";
                                                    components[i * 2 + j] = <a
                                                        class={style}
                                                        onMouseEnter={(e) => {
                                                            if (props.load) setHoveredNumber(props.load(ptr, 2));
                                                            setMousePos({ x: e.clientX, y: e.clientY });
                                                        }}
                                                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                                        onMouseLeave={() => setHoveredNumber(null)}
                                                    >
                                                        {text}
                                                    </a>
                                                }
                                            } else if (bytesPerUnit == 4) {
                                                let style = select;
                                                let ptr = start + (idx * chunks + i) * 4;
                                                if ((idx * chunks + i) * 4 >= 65536) break;
                                                let isAnimated = ptr >= props.writeAddr && ptr < props.writeAddr + props.writeLen;
                                                let grayedOut = activeTab() == "stack" && ptr < props.sp;
                                                if (grayedOut) style = "theme-fg2";
                                                if (ptr >= props.sp && ptr < props.sp + 4) style = "frame-highlight";
                                                if (isAnimated) style = "animate-fade-highlight";
                                                let text = props.load ? toUnsigned(props.load(ptr, 4)).toString(16).padStart(8, "0") : "00000000";
                                                style += " mr-[2.5ch]";
                                                components[i] = <a
                                                    class={style}
                                                    onMouseEnter={(e) => {
                                                        if (props.load) setHoveredNumber(props.load(ptr, 4));
                                                        setMousePos({ x: e.clientX, y: e.clientY });
                                                    }}
                                                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                                    onMouseLeave={() => setHoveredNumber(null)}
                                                >
                                                    {text}
                                                </a>
                                            }
                                        }
                                        return components;
                                    })()}
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        </div>
    );
};

const ShadowStack: Component<{ version: () => any, shadowStackAugmented: ShadowStackAugmentedEnt[] }> = (props) =>
    <For each={props.shadowStackAugmented}>
        {(elem) => (
            <div class="flex flex-col pb-4">
                <div>{elem.name}</div>
                <For each={elem.elems}>
                    {(elem) =>
                        <div class="flex flex-row">
                            <a class="theme-fg2 pr-2">{elem.addr}</a>
                            <div class={elem.isAnimated ? "animate-fade-highlight" : ""}>{elem.text}</div>
                        </div>
                    }
                </For>
            </div>
        )}
    </For>;