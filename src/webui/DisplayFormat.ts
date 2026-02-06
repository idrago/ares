import { createSignal } from "solid-js";

export type DisplayFormat = "hex" | "unsigned" | "signed";
export type UnitSize = "byte" | "half" | "word";

const [displayFormat, setDisplayFormat] = createSignal<DisplayFormat>("hex");
const [unitSize, setUnitSize] = createSignal<UnitSize>("byte");

export { displayFormat, setDisplayFormat, unitSize, setUnitSize };

/**
 * Get the maximum cell width needed for any format (prevents layout jitter)
 */
export function getCellWidthChars(bytes: number): number {
    const hexWidth = bytes * 2;
    const unsignedWidth = bytes === 1 ? 3 : bytes === 2 ? 5 : 10;
    const signedWidth = bytes === 1 ? 4 : bytes === 2 ? 6 : 11;

    // Always return the maximum width to prevent layout jitter when switching formats
    return Math.max(hexWidth, unsignedWidth, signedWidth);
}

/**
 * Format memory value (shows bytes in storage order for hex)
 */
export function formatMemoryValue(value: number, bytes: number, format?: DisplayFormat): string {
    const fmt = format ?? displayFormat();
    const width = getCellWidthChars(bytes);
    
    switch (fmt) {
        case "hex": {
            // Show bytes in memory storage order (little-endian)
            let hex = "";
            for (let i = 0; i < bytes; i++) {
                hex += ((value >> (i * 8)) & 0xFF).toString(16).padStart(2, "0");
            }
            return hex.padStart(width, " ");
        }
        case "unsigned":
            return (value >>> 0).toString().padStart(width, " ");
        case "signed": {
            // Sign extend based on size
            const shift = 32 - (bytes * 8);
            const signed = (value << shift) >> shift;
            return signed.toString().padStart(width, " ");
        }
    }
}

/**
 * Format register value (always shows full 32-bit value)
 */
export function formatRegister(value: number, format?: DisplayFormat): string {
    const fmt = format ?? displayFormat();
    switch (fmt) {
        case "hex": 
            return "0x" + (value >>> 0).toString(16).padStart(8, "0");
        case "unsigned": 
            return (value >>> 0).toString();
        case "signed": 
            return (value | 0).toString();
    }
}