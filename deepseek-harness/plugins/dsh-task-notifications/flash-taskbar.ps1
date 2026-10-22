# Backend invocation: pwsh -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden
#   -File <this script> -ExecutablePath <absolute DSH desktop executable path>
# stdout: one compact JSON object. 'requested' means FlashWindowEx was called,
# not that Windows displayed a flash. Exit 0 for normal outcomes, 1 for errors.
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string] $ExecutablePath
)

$ErrorActionPreference = 'Stop'

try {
    if (-not [System.IO.Path]::IsPathFullyQualified($ExecutablePath)) {
        throw 'ExecutablePath must be an absolute path.'
    }
    $targetPath = [System.IO.Path]::GetFullPath($ExecutablePath)

    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace DshTaskNotifications
{
    public static class Taskbar
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct FLASHWINFO
        {
            public uint cbSize;
            public IntPtr hwnd;
            public uint dwFlags;
            public uint uCount;
            public uint dwTimeout;
        }

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool FlashWindowEx(ref FLASHWINFO info);
    }
}
'@

    $foregroundWindow = [DshTaskNotifications.Taskbar]::GetForegroundWindow()
    [uint32] $foregroundProcessId = 0
    [void] [DshTaskNotifications.Taskbar]::GetWindowThreadProcessId(
        $foregroundWindow, [ref] $foregroundProcessId)

    $targetProcessIds = @()
    $windows = @()
    foreach ($process in [System.Diagnostics.Process]::GetProcesses()) {
        try {
            # Path access can fail for protected or already-exited processes.
            $processPath = $process.MainModule.FileName
            if (-not [string]::Equals($processPath, $targetPath,
                    [System.StringComparison]::OrdinalIgnoreCase)) {
                continue
            }
            $targetProcessIds += $process.Id
            $window = $process.MainWindowHandle
            if ($window -ne [IntPtr]::Zero) {
                $windows += $window
            }
        }
        catch {
            continue
        }
        finally {
            $process.Dispose()
        }
    }

    if ($foregroundProcessId -in $targetProcessIds) {
        @{ status = 'foreground' } | ConvertTo-Json -Compress
        exit 0
    }
    if ($windows.Count -ne 1) {
        # Never guess between multiple instances of the same executable.
        $reason = if ($windows.Count -eq 0) { 'not_found' } else { 'ambiguous' }
        @{ status = 'missing_target'; reason = $reason } | ConvertTo-Json -Compress
        exit 0
    }

    # Recheck immediately before requesting a flash, in case focus changed.
    [uint32] $currentForegroundProcessId = 0
    [void] [DshTaskNotifications.Taskbar]::GetWindowThreadProcessId(
        [DshTaskNotifications.Taskbar]::GetForegroundWindow(),
        [ref] $currentForegroundProcessId)
    if ($currentForegroundProcessId -in $targetProcessIds) {
        @{ status = 'foreground' } | ConvertTo-Json -Compress
        exit 0
    }

    $info = [DshTaskNotifications.Taskbar+FLASHWINFO]::new()
    $info.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
    $info.hwnd = $windows[0]
    $info.dwFlags = 14 # FLASHW_TRAY | FLASHW_TIMERNOFG: stop when foreground.
    $info.uCount = [uint32]::MaxValue
    $info.dwTimeout = 0 # Use the system's default flash rate.
    # The return value reports the previous active state, not success/failure.
    [void] [DshTaskNotifications.Taskbar]::FlashWindowEx([ref] $info)
    @{ status = 'requested' } | ConvertTo-Json -Compress
}
catch {
    @{ status = 'error'; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
