export const moodleBuild = import.meta.env.VITE_MOODLE_BUILD === "1";

export function getTestSuiteName(): string | null {
    if (moodleBuild) return null;
    return new URLSearchParams(window.location.search).get("testsuite");
}
