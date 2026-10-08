import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);

// Optional Windows working-set sampling for the dedicated benchmark browser
// tree. Never reads command lines or images. Sampling misses brief peaks.
export function monitorBrowserMemory(pid) {
  if (process.platform !== "win32") return async () => undefined;
  if (!Number.isInteger(pid) || pid < 1) throw new Error("Invalid browser pid");
  let peak = 0,
    stopped = false,
    timer,
    pending;
  const sample = async () => {
    try {
      const command = `$all = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId; $ids = [System.Collections.Generic.HashSet[int]]::new(); [void]$ids.Add(${pid}); do { $added = $false; foreach ($entry in $all) { if ($ids.Contains([int]$entry.ParentProcessId) -and $ids.Add([int]$entry.ProcessId)) { $added = $true } } } while ($added); $sum = (Get-Process -Id @($ids) -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum; [Console]::Write([long]$sum)`;
      const { stdout } = await execute(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", command],
        { windowsHide: true, timeout: 5000 },
      );
      const bytes = Number(stdout);
      if (Number.isFinite(bytes)) peak = Math.max(peak, bytes);
    } catch {
      /* Heap metrics remain available without OS sampling. */
    }
    if (!stopped)
      timer = setTimeout(() => {
        pending = sample();
      }, 2000);
  };
  pending = sample();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await pending;
    return peak || undefined;
  };
}
