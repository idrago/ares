import { linter } from "@codemirror/lint";

export const createAsmLinter = (doBuild: (text: string) => boolean, getDiagnostics: () => ({ line: number, message: string } | undefined)) => {
  let delay: number = 300;
  return linter(
    async (ev) => {
      let enable = doBuild(ev.state.doc.toString());
      if (!enable) return [];
      let diagnostics = getDiagnostics();
      return diagnostics ? [
        {
          from: ev.state.doc.line(diagnostics.line).from,
          to: ev.state.doc.line(diagnostics.line).to,
          message: diagnostics.message,
          severity: "error",
        },
      ] : [];
    },
    {
      delay: delay,
    },
  );
};
