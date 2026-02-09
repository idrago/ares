import { LRLanguage } from "@codemirror/language"
import { parser } from "./riscv.grammar";
import { styleTags, tags as t } from "@lezer/highlight";

const highlighting = styleTags({
    Instruction: t.controlKeyword,
    Number: t.number,
    Register: t.variableName,
    Directive: t.operator,
    String: t.string,
    LineComment: t.comment,
    BlockComment: t.comment,
});

let parserWithMetadata = parser.configure({
    props: [highlighting]
})

export const riscvLanguage = LRLanguage.define({
    parser: parserWithMetadata,
})


