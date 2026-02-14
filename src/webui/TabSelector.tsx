import { Component } from "solid-js";

export const TabSelector: Component<{
    tab: string;
    setTab: (newTab: string) => void;
    tabs: string[];
}> = (props) => {
    return (
        <div class="w-full theme-gutter border-b theme-border">
            <div class="flex gap-1 px-2 py-1">
                {props.tabs.map((currTab) => (
                    <button
                        class={`px-3 py-1 text-sm font-medium rounded-t transition-colors ${
                            props.tab === currTab 
                                ? "theme-bg theme-fg border-l border-r border-t theme-border" 
                                : "theme-fg2"
                        }`}
                        onClick={() => props.setTab(currTab)}
                    >
                        {currTab}
                    </button>
                ))}
            </div>
        </div>
    );
}