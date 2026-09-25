// The PASS/FAIL recorder + report table.
//
// A drive is a list of named checks. `check()` runs one, catches whatever it
// throws, records it, and KEEPS GOING — one broken assertion must not hide the
// other nine. `report()` prints the table and returns the exit code.

const GREEN = "[32m";
const RED = "[31m";
const YELLOW = "[33m";
const DIM = "[2m";
const RESET = "[0m";

export function createRun(title) {
  const rows = [];
  const started = Date.now();

  console.log(
    `\n${DIM}── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}${RESET}`,
  );

  async function check(name, body) {
    const at = Date.now();

    try {
      const detail = await body();
      rows.push({
        name,
        status: "PASS",
        detail: typeof detail === "string" ? detail : "",
        ms: Date.now() - at,
      });
      console.log(
        `${GREEN}PASS${RESET}  ${name}${typeof detail === "string" && detail ? ` ${DIM}— ${detail}${RESET}` : ""}`,
      );
      return true;
    } catch (error) {
      const message = (error?.message ?? String(error)).trim();
      rows.push({ name, status: "FAIL", detail: message, ms: Date.now() - at });
      console.log(`${RED}FAIL${RESET}  ${name}`);
      for (const line of message.split("\n")) {
        console.log(`      ${RED}${line}${RESET}`);
      }
      return false;
    }
  }

  /** Record a row without running anything — for facts established outside a
   * browser assertion (an HTTP probe, a DB read, a "could not be exercised"
   * note). `status` is PASS | FAIL | SKIP. */
  function record(name, status, detail = "") {
    rows.push({ name, status, detail, ms: 0 });
    const color = status === "PASS" ? GREEN : status === "FAIL" ? RED : YELLOW;
    console.log(
      `${color}${status.padEnd(4)}${RESET}  ${name}${detail ? ` ${DIM}— ${detail}${RESET}` : ""}`,
    );
    return status === "PASS";
  }

  function section(label) {
    console.log(`\n${DIM}${label}${RESET}`);
  }

  function report() {
    const width = Math.max(...rows.map((r) => r.name.length), 10);
    const failed = rows.filter((r) => r.status === "FAIL");
    const skipped = rows.filter((r) => r.status === "SKIP");

    console.log(`\n${DIM}${"═".repeat(width + 22)}${RESET}`);
    console.log(`${"CHECK".padEnd(width)}   RESULT   TIME`);
    console.log(`${DIM}${"─".repeat(width + 22)}${RESET}`);

    for (const row of rows) {
      const color =
        row.status === "PASS" ? GREEN : row.status === "FAIL" ? RED : YELLOW;
      console.log(
        `${row.name.padEnd(width)}   ${color}${row.status.padEnd(6)}${RESET}   ${row.ms ? `${row.ms}ms` : "—"}`,
      );
    }

    console.log(`${DIM}${"─".repeat(width + 22)}${RESET}`);
    console.log(
      `${rows.length - failed.length - skipped.length}/${rows.length} passed` +
        (skipped.length ? `, ${skipped.length} skipped` : "") +
        (failed.length ? `, ${RED}${failed.length} FAILED${RESET}` : "") +
        ` ${DIM}(${((Date.now() - started) / 1000).toFixed(1)}s)${RESET}`,
    );

    if (failed.length) {
      console.log(`\n${RED}FAILURES${RESET}`);
      for (const row of failed) {
        console.log(
          `  • ${row.name}\n    ${row.detail.split("\n").join("\n    ")}`,
        );
      }
    }

    return failed.length === 0 ? 0 : 1;
  }

  return { check, record, section, report, rows };
}
