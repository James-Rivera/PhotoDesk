using System.ComponentModel;
using System.Drawing.Printing;
using System.Runtime.InteropServices;

namespace CJNET.PrintHelper;

internal static class PrinterJobProperties
{
    private const int DmOutBuffer = 0x00000002;
    private const int DmInPrompt = 0x00000004;
    private const int DmInBuffer = 0x00000008;
    private const int IdOk = 1;
    private const int IdCancel = 2;
    private const uint GmemMoveable = 0x0002;
    private const uint GmemZeroInit = 0x0040;

    internal static bool Show(IWin32Window owner, PrintDocument document)
    {
        var printerName = document.PrinterSettings.PrinterName;
        if (!OpenPrinter(printerName, out var printerHandle, IntPtr.Zero))
            throw new Win32Exception(Marshal.GetLastWin32Error(), $"Windows could not open printer '{printerName}'.");

        IntPtr currentDevModeHandle = IntPtr.Zero;
        IntPtr outputDevModeHandle = IntPtr.Zero;
        IntPtr currentDevMode = IntPtr.Zero;
        IntPtr outputDevMode = IntPtr.Zero;

        try
        {
            var requiredBytes = DocumentProperties(
                owner.Handle,
                printerHandle,
                printerName,
                IntPtr.Zero,
                IntPtr.Zero,
                0);
            if (requiredBytes <= 0)
                throw CreateDocumentPropertiesException("The Epson settings size could not be read.");

            outputDevModeHandle = GlobalAlloc(GmemMoveable | GmemZeroInit, (UIntPtr)(uint)requiredBytes);
            if (outputDevModeHandle == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Windows could not allocate printer settings memory.");

            outputDevMode = GlobalLock(outputDevModeHandle);
            if (outputDevMode == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Windows could not access printer settings memory.");

            currentDevModeHandle = document.PrinterSettings.GetHdevmode(document.DefaultPageSettings);
            currentDevMode = GlobalLock(currentDevModeHandle);
            if (currentDevMode == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Windows could not access the current PhotoDesk print settings.");

            var initializeResult = DocumentProperties(
                owner.Handle,
                printerHandle,
                printerName,
                outputDevMode,
                currentDevMode,
                DmInBuffer | DmOutBuffer);
            if (initializeResult != IdOk)
                throw CreateDocumentPropertiesException("The Epson settings could not be initialized.");

            var promptResult = DocumentProperties(
                owner.Handle,
                printerHandle,
                printerName,
                outputDevMode,
                outputDevMode,
                DmInPrompt | DmInBuffer | DmOutBuffer);
            if (promptResult == IdCancel) return false;
            if (promptResult != IdOk)
                throw CreateDocumentPropertiesException("The Epson settings dialog could not be opened.");

            document.PrinterSettings.SetHdevmode(outputDevModeHandle);
            document.DefaultPageSettings.SetHdevmode(outputDevModeHandle);
            return true;
        }
        finally
        {
            if (currentDevMode != IntPtr.Zero) GlobalUnlock(currentDevModeHandle);
            if (currentDevModeHandle != IntPtr.Zero) GlobalFree(currentDevModeHandle);
            if (outputDevMode != IntPtr.Zero) GlobalUnlock(outputDevModeHandle);
            if (outputDevModeHandle != IntPtr.Zero) GlobalFree(outputDevModeHandle);
            ClosePrinter(printerHandle);
        }
    }

    private static Win32Exception CreateDocumentPropertiesException(string message)
    {
        var errorCode = Marshal.GetLastWin32Error();
        return errorCode == 0 ? new Win32Exception(message) : new Win32Exception(errorCode, message);
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool OpenPrinter(string printerName, out IntPtr printerHandle, IntPtr defaults);

    [DllImport("winspool.drv", EntryPoint = "DocumentPropertiesW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int DocumentProperties(
        IntPtr owner,
        IntPtr printerHandle,
        string deviceName,
        IntPtr outputDevMode,
        IntPtr inputDevMode,
        int mode);

    [DllImport("winspool.drv", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ClosePrinter(IntPtr printerHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalAlloc(uint flags, UIntPtr bytes);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalLock(IntPtr memoryHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalUnlock(IntPtr memoryHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalFree(IntPtr memoryHandle);
}
