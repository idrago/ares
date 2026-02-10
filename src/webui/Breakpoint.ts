import { RangeSet, StateEffect, StateField } from "@codemirror/state";

import { EditorView, gutter, GutterMarker } from "@codemirror/view";

const breakpointMarker = new (class extends GutterMarker {
  toDOM() {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.height = "100%";

    const circle = document.createElement("span");
    circle.style.display = "inline-block";
    circle.style.width = "0.75em";
    circle.style.height = "0.75em";
    circle.style.borderRadius = "50%";
    circle.classList = "cm-breakpoint-marker";

    container.appendChild(circle);
    return container;
  }
})();

const breakpointEffect = StateEffect.define<{ pos: number; on: boolean }>({
  map: (val, mapping) => ({ pos: mapping.mapPos(val.pos), on: val.on }),
});

// TODO: slightly more polished vscode-like approach
// where hover counts on the linenumber view too, not just the empty space
export function breakpointGutter(update: (lines: number[]) => void) {
  const breakpointState = StateField.define<RangeSet<GutterMarker>>({
    create() {
      return RangeSet.empty;
    },
    update(set, transaction) {
      set = set.map(transaction.changes);
      for (let e of transaction.effects) {
        if (e.is(breakpointEffect)) {
          if (e.value.on)
            set = set.update({
              add: [breakpointMarker.range(e.value.pos)],
            });
          else set = set.update({ filter: (from) => from != e.value.pos });
        }
      }
      return set;
    },
  });
  return [
    breakpointState,
    gutter({
      class: "cm-breakpoint-gutter",
      markers: (v) => v.state.field(breakpointState),
      initialSpacer: () => breakpointMarker,
      renderEmptyElements: true,
      domEventHandlers: {
        mousedown(view, line) {
          const pos = line.from; // why is it 0-idx'd here
          let breakpoints = view.state.field(breakpointState);
          let hasBreakpoint = false;
          breakpoints.between(pos, pos, () => {
            hasBreakpoint = true;
          });
          view.dispatch({
            effects: breakpointEffect.of({ pos, on: !hasBreakpoint }),
          });

          let arr: number[] = [];
          view.state.field(breakpointState).between(0, view.state.doc.length, (from) => {
            arr.push(view.state.doc.lineAt(from).number);
          });
          update(arr);
          return true;
        },
      },
    }),
    EditorView.baseTheme({
      ".cm-breakpoint-gutter .cm-gutterElement": {
        color: "red",
        cursor: "default",
        paddingLeft: "0.3em",
        position: "relative",
      },
      ".cm-breakpoint-gutter .cm-gutterElement:hover::before": {
        content: '""',
        position: "absolute",
        left: "0.3em",
        top: "50%",
        transform: "translateY(-50%)",
        width: "0.75em",
        height: "0.75em",
        borderRadius: "50%",
        backgroundColor: "red",
        opacity: "0.2",
      },
      ".cm-breakpoint-gutter .cm-gutterElement:has(.cm-breakpoint-marker)::before": {
        display: "none",
      },
    }),
  ];
}
