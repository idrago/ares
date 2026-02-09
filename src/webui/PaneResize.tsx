import { Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";

export const PaneResize: Component<{
    firstSize: number;
    direction: "vertical" | "horizontal";
    second?: any;
    children: [() => JSX.Element, (data: any) => JSX.Element];
}> = (props) => {
    let handle!: HTMLDivElement;
    let container!: HTMLDivElement;

    const [size, setSize] = createSignal(0);
    const [containerSize, setContainerSize] = createSignal(0);

    const [dragStart, setDragStart] = createSignal<{
        position: number;
        size: number;
        pointerId: number;
    } | null>(null);

    const getClient = (e: PointerEvent) => {
        return props.direction === "vertical" ? e.clientY : e.clientX;
    };

    const getContainerDim = () => {
        if (!container) return 0;
        return props.direction === "vertical"
            ? container.clientHeight
            : container.clientWidth;
    };

    const resizeDown = (e: PointerEvent) => {
        e.preventDefault();

        handle.setPointerCapture(e.pointerId);

        setDragStart({
            position: getClient(e),
            size: size(),
            pointerId: e.pointerId,
        });

        document.body.style.userSelect = "none";
        document.body.style.cursor = props.direction === "vertical"
            ? "row-resize"
            : "col-resize";
    };

    const resizeMove = (e: PointerEvent) => {
        const start = dragStart();
        if (!start) return;

        e.preventDefault();

        const currentPos = getClient(e);
        const delta = currentPos - start.position;
        const containerDim = getContainerDim();

        const minSize = 50;
        const maxSize = containerDim - 4 - minSize;

        const newSize = Math.max(minSize, Math.min(start.size + delta, maxSize));
        setSize(newSize);
    };

    const resizeUp = (e: PointerEvent) => {
        const start = dragStart();
        if (!start) return;

        handle.releasePointerCapture(start.pointerId);

        setDragStart(null);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
    };

    const handleContainerResize = () => {
        const newContainerSize = getContainerDim();
        if (newContainerSize === 0) return;

        const prevContainerSize = containerSize();

        if (!prevContainerSize) {
            setContainerSize(newContainerSize);
            setSize(newContainerSize * props.firstSize);
            return;
        }

        // TODO: enforce caps even on resize, need to decide how
        const ratio = size() / prevContainerSize;
        setSize(newContainerSize * ratio);
        setContainerSize(newContainerSize);
    };

    onMount(() => {
        const initialDim = getContainerDim();
        if (initialDim > 0) {
            setContainerSize(initialDim);
            setSize(initialDim * props.firstSize);
        }

        const ro = new ResizeObserver(() => {
            if (!dragStart()) {
                handleContainerResize();
            }
        });
        ro.observe(container);

        onCleanup(() => {
            ro.disconnect();
            document.body.style.userSelect = "";
            document.body.style.cursor = "";

            const start = dragStart();
            if (start && handle) {
                try {
                    handle.releasePointerCapture(start.pointerId);
                } catch {
                    // pointer already released
                }
            }
        });
    });

    return (
        <div
            ref={container}
            class="flex w-full h-full theme-fg theme-bg"
            classList={{
                "flex-col": props.direction === "vertical",
                "flex-row": props.direction === "horizontal",
            }}
        >
            <div
                class="flex-shrink-0 overflow-hidden"
                style={{
                    height: props.direction === "vertical"
                        ? (props.second ? `${size()}px` : "100%")
                        : "100%",
                    width: props.direction === "horizontal"
                        ? (props.second ? `${size()}px` : "100%")
                        : "100%",
                }}
            >
                {props.children[0]()}
            </div>

            <Show when={props.second}>
                <div
                    ref={handle}
                    onPointerDown={resizeDown}
                    onPointerMove={resizeMove}
                    onPointerUp={resizeUp}
                    onPointerCancel={resizeUp}
                    class={
                        props.direction === "vertical"
                            ? "w-full h-[4px] cursor-row-resize theme-separator flex-shrink-0"
                            : "h-full w-[4px] cursor-col-resize theme-separator flex-shrink-0"
                    }
                />
            </Show>

            <Show when={props.second}>
                <div class="flex-grow flex-shrink overflow-hidden min-w-0 min-h-0">
                    {props.children[1](props.second)}
                </div>
            </Show>
        </div>
    );
};