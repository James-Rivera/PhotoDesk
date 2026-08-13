using System.Security.Cryptography;
using System.Net;
using System.Diagnostics;
using System.Drawing.Printing;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CJNET.PrintHelper;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        using var singleInstance = new Mutex(true, "Local\\CJNET.PhotoDesk.PrintHelper", out var ownsMutex);
        if (!ownsMutex)
        {
            MessageBox.Show("CJNET Print Helper is already running in the Windows tray.", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        ApplicationConfiguration.Initialize();
        using var context = new HelperContext();
        Application.Run(context);
    }
}

internal sealed class HelperContext : ApplicationContext
{
    internal const string Version = "0.2.0";
    internal const int Port = 17421;
    internal const int MaxPdfBytes = 30 * 1024 * 1024;

    private readonly string pairingCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
    private readonly Dictionary<string, string> pairedOrigins;
    private readonly HttpListener listener = new();
    private readonly CancellationTokenSource shutdown = new();
    private readonly NotifyIcon trayIcon;
    private readonly string tempDirectory = Path.Combine(Path.GetTempPath(), "CJNET-PhotoDesk-Prints");
    private readonly string settingsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CJNET", "PrintHelper", "paired-origins.json");
    private readonly Control dispatcher = new();
    private PrintWindow? printWindow;

    public HelperContext()
    {
        pairedOrigins = LoadPairings();
        Directory.CreateDirectory(tempDirectory);
        dispatcher.CreateControl();
        trayIcon = new NotifyIcon
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application,
            Text = "CJNET Print Helper",
            Visible = true,
            ContextMenuStrip = BuildMenu(),
        };

        listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
        listener.Start();
        _ = ListenAsync();
        trayIcon.ShowBalloonTip(4000, "CJNET Print Helper", "Ready for PhotoDesk. Right-click this icon to show the pairing code.", ToolTipIcon.Info);
    }

    private ContextMenuStrip BuildMenu()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Show pairing code", null, (_, _) => ShowPairingCode());
        menu.Items.Add("Forget paired websites", null, (_, _) =>
        {
            pairedOrigins.Clear();
            SavePairings();
            MessageBox.Show("All paired PhotoDesk websites were removed.", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Information);
        });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit", null, (_, _) => ExitThread());
        return menu;
    }

    private void ShowPairingCode() => MessageBox.Show(
        $"Pairing code: {pairingCode}\n\nEnter this code in PhotoDesk on this computer. It changes whenever the helper restarts.",
        "CJNET Print Helper",
        MessageBoxButtons.OK,
        MessageBoxIcon.Information);

    private async Task ListenAsync()
    {
        while (!shutdown.IsCancellationRequested)
        {
            try
            {
                var context = await listener.GetContextAsync().WaitAsync(shutdown.Token);
                _ = HandleAsync(context);
            }
            catch (OperationCanceledException) { break; }
            catch (HttpListenerException) when (shutdown.IsCancellationRequested) { break; }
        }
    }

    private async Task HandleAsync(HttpListenerContext context)
    {
        var origin = context.Request.Headers["Origin"];
        AddCorsHeaders(context.Response, origin);
        if (context.Request.HttpMethod == "OPTIONS")
        {
            context.Response.StatusCode = 204;
            context.Response.Close();
            return;
        }

        try
        {
            switch ((context.Request.HttpMethod, context.Request.Url?.AbsolutePath))
            {
                case ("GET", "/health"):
                    await WriteJson(context.Response, new { ok = true, version = Version, paired = origin is not null && pairedOrigins.ContainsKey(origin) });
                    break;
                case ("POST", "/pair"):
                    await PairAsync(context, origin);
                    break;
                case ("POST", "/print-dialog"):
                    await OpenPrintDialogAsync(context, origin);
                    break;
                default:
                    await WriteError(context.Response, 404, "Unknown helper endpoint.");
                    break;
            }
        }
        catch (Exception error)
        {
            await WriteError(context.Response, 500, $"The print helper failed: {error.Message}");
        }
    }

    private async Task PairAsync(HttpListenerContext context, string? origin)
    {
        if (!IsAllowedOrigin(origin))
        {
            await WriteError(context.Response, 403, "This website is not allowed to pair with CJNET Print Helper.");
            return;
        }

        var body = await JsonSerializer.DeserializeAsync<PairRequest>(context.Request.InputStream);
        if (body?.Code != pairingCode)
        {
            await WriteError(context.Response, 401, "Incorrect pairing code.");
            return;
        }

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        pairedOrigins[origin!] = token;
        SavePairings();
        await WriteJson(context.Response, new { ok = true, token });
    }

    private async Task OpenPrintDialogAsync(HttpListenerContext context, string? origin)
    {
        if (!IsAuthorized(context.Request, origin))
        {
            await WriteError(context.Response, 401, "PhotoDesk must pair with this helper before printing.");
            return;
        }

        if (context.Request.ContentLength64 is < 1 or > MaxPdfBytes)
        {
            await WriteError(context.Response, 413, "The print file is empty or larger than 30 MB.");
            return;
        }

        var pdfBytes = new byte[(int)context.Request.ContentLength64];
        await context.Request.InputStream.ReadExactlyAsync(pdfBytes);
        if (pdfBytes.Length < 5 || Encoding.ASCII.GetString(pdfBytes, 0, 5) != "%PDF-")
        {
            await WriteError(context.Response, 415, "CJNET Print Helper accepts PDF files only.");
            return;
        }

        var path = Path.Combine(tempDirectory, $"CJNET-{Guid.NewGuid():N}.pdf");
        await File.WriteAllBytesAsync(path, pdfBytes);
        BeginInvokeOnUi(() => ShowPrintWindow(path));
        await WriteJson(context.Response, new { ok = true, message = "CJNET print preview opened." });
    }

    private void ShowPrintWindow(string path)
    {
        if (printWindow is not null && !printWindow.IsDisposed)
        {
            MessageBox.Show("Finish or close the current print dialog first.", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Information);
            TryDelete(path);
            return;
        }

        printWindow = new PrintWindow(path);
        printWindow.FormClosed += (_, _) =>
        {
            TryDelete(path);
            printWindow = null;
        };
        printWindow.Show();
        printWindow.Activate();
    }

    private void BeginInvokeOnUi(Action action)
    {
        dispatcher.BeginInvoke(action);
    }

    private bool IsAuthorized(HttpListenerRequest request, string? origin) =>
        origin is not null && pairedOrigins.TryGetValue(origin, out var expected) &&
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(request.Headers["X-CJNET-Print-Token"] ?? string.Empty));

    private static bool IsAllowedOrigin(string? origin)
    {
        if (origin is null || !Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme == Uri.UriSchemeHttps) return true;
        return uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback;
    }

    private static void AddCorsHeaders(HttpListenerResponse response, string? origin)
    {
        if (!IsAllowedOrigin(origin)) return;
        response.Headers["Access-Control-Allow-Origin"] = origin;
        response.Headers["Vary"] = "Origin";
        response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        response.Headers["Access-Control-Allow-Headers"] = "Content-Type, X-CJNET-Print-Token";
        response.Headers["Access-Control-Allow-Private-Network"] = "true";
        response.Headers["Private-Network-Access-Name"] = "CJNET Print Helper";
        response.Headers["Private-Network-Access-ID"] = "00:00:00:00:00:01";
    }

    private static async Task WriteJson(HttpListenerResponse response, object value)
    {
        response.ContentType = "application/json";
        await JsonSerializer.SerializeAsync(response.OutputStream, value);
        response.Close();
    }

    private static async Task WriteError(HttpListenerResponse response, int status, string message)
    {
        response.StatusCode = status;
        await WriteJson(response, new { ok = false, error = message });
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); } catch { }
    }

    private Dictionary<string, string> LoadPairings()
    {
        try
        {
            return File.Exists(settingsPath)
                ? JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(settingsPath)) ?? new(StringComparer.Ordinal)
                : new(StringComparer.Ordinal);
        }
        catch { return new(StringComparer.Ordinal); }
    }

    private void SavePairings()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(settingsPath)!);
        File.WriteAllText(settingsPath, JsonSerializer.Serialize(pairedOrigins));
    }

    protected override void ExitThreadCore()
    {
        shutdown.Cancel();
        listener.Stop();
        trayIcon.Visible = false;
        trayIcon.Dispose();
        dispatcher.Dispose();
        printWindow?.Close();
        base.ExitThreadCore();
    }

    private sealed record PairRequest([property: JsonPropertyName("code")] string Code);
}

internal sealed class PrintWindow : Form
{
    private const double A4WidthInches = 210.0 / 25.4;
    private const double A4HeightInches = 297.0 / 25.4;

    private readonly WebView2 webView = new() { Dock = DockStyle.Fill };
    private readonly ComboBox printerList = new() { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Top };
    private readonly NumericUpDown copies = new() { Minimum = 1, Maximum = 99, Value = 1, Dock = DockStyle.Top };
    private readonly Button propertiesButton = new() { Text = "Printer properties", Height = 42, Dock = DockStyle.Top };
    private readonly Button printButton = new() { Text = "Print 1 A4 sheet", Height = 46, Dock = DockStyle.Top, Enabled = false };
    private readonly Label statusLabel = new() { AutoSize = false, Height = 44, Dock = DockStyle.Top, ForeColor = Color.DimGray };
    private readonly string pdfPath;

    public PrintWindow(string pdfPath)
    {
        this.pdfPath = pdfPath;
        Text = "CJNET PhotoDesk - Print";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Width = 1120;
        Height = 780;
        MinimumSize = new Size(900, 640);
        StartPosition = FormStartPosition.CenterScreen;
        ShowInTaskbar = true;
        BackColor = Color.FromArgb(245, 241, 232);

        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Padding = new Padding(12) };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 300));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.Controls.Add(webView, 0, 0);
        layout.Controls.Add(BuildControls(), 1, 0);
        Controls.Add(layout);

        LoadPrinters();
        copies.ValueChanged += (_, _) => UpdatePrintButtonText();
        propertiesButton.Click += (_, _) => OpenPrinterProperties();
        printButton.Click += async (_, _) => await PrintAsync();
        Shown += OnShown;
    }

    private Control BuildControls()
    {
        var panel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(20, 8, 8, 8) };
        var closeButton = new Button { Text = "Cancel", Height = 38, Dock = DockStyle.Bottom };
        closeButton.Click += (_, _) => Close();

        var content = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
        };

        content.Controls.Add(MakeLabel("PRINT A4 PHOTO", 9, FontStyle.Bold, Color.FromArgb(90, 82, 62), 30));
        content.Controls.Add(MakeLabel("Ready to print", 16, FontStyle.Bold, Color.FromArgb(23, 23, 23), 34));
        content.Controls.Add(MakeLabel("The left side is the exact one-page A4 PDF.", 10, FontStyle.Regular, Color.DimGray, 46));
        content.Controls.Add(MakeLabel("Printer", 10, FontStyle.Bold, Color.FromArgb(23, 23, 23), 26));
        content.Controls.Add(printerList);
        content.Controls.Add(Spacer(10));
        content.Controls.Add(propertiesButton);
        content.Controls.Add(MakeLabel("Set Epson Photo Quality Ink Jet and Standard or High quality. Close Properties before printing.", 9, FontStyle.Regular, Color.DimGray, 62));
        content.Controls.Add(MakeLabel("Copies", 10, FontStyle.Bold, Color.FromArgb(23, 23, 23), 26));
        content.Controls.Add(copies);
        content.Controls.Add(Spacer(14));
        content.Controls.Add(printButton);
        content.Controls.Add(statusLabel);

        foreach (Control control in content.Controls)
        {
            control.Width = 270;
            control.Margin = new Padding(0, 0, 0, 4);
        }

        panel.Controls.Add(content);
        panel.Controls.Add(closeButton);
        return panel;
    }

    private static Label MakeLabel(string text, float size, FontStyle style, Color color, int height) => new()
    {
        Text = text,
        Font = new Font("Segoe UI", size, style),
        ForeColor = color,
        Height = height,
        AutoSize = false,
    };

    private static Control Spacer(int height) => new Panel { Height = height };

    private void LoadPrinters()
    {
        try
        {
            foreach (string printer in PrinterSettings.InstalledPrinters) printerList.Items.Add(printer);
            var defaultPrinter = new PrinterSettings().PrinterName;
            var defaultIndex = printerList.Items.IndexOf(defaultPrinter);
            if (printerList.Items.Count > 0) printerList.SelectedIndex = defaultIndex >= 0 ? defaultIndex : 0;
        }
        catch (Exception error)
        {
            statusLabel.Text = $"Windows printers could not load: {error.Message}";
        }
        propertiesButton.Enabled = printerList.Items.Count > 0;
        if (printerList.Items.Count == 0 && string.IsNullOrWhiteSpace(statusLabel.Text)) statusLabel.Text = "No Windows printers were found.";
    }

    private void OpenPrinterProperties()
    {
        if (printerList.SelectedItem is not string printerName) return;
        try
        {
            var startInfo = new ProcessStartInfo("rundll32.exe") { UseShellExecute = true };
            startInfo.ArgumentList.Add("printui.dll,PrintUIEntry");
            startInfo.ArgumentList.Add("/e");
            startInfo.ArgumentList.Add("/n");
            startInfo.ArgumentList.Add(printerName);
            Process.Start(startInfo);
            statusLabel.Text = "Close Printer Properties when finished, then click Print.";
        }
        catch (Exception error)
        {
            MessageBox.Show($"Printer Properties could not open.\n\n{error.Message}", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void UpdatePrintButtonText() => printButton.Text = copies.Value == 1 ? "Print 1 A4 sheet" : $"Print {copies.Value} A4 sheets";

    private async Task PrintAsync()
    {
        if (printerList.SelectedItem is not string printerName || webView.CoreWebView2 is null) return;
        printButton.Enabled = false;
        propertiesButton.Enabled = false;
        statusLabel.Text = "Sending the exact A4 sheet to Windows...";
        try
        {
            var settings = webView.CoreWebView2.Environment.CreatePrintSettings();
            settings.PrinterName = printerName;
            settings.Copies = (int)copies.Value;
            settings.Orientation = CoreWebView2PrintOrientation.Portrait;
            settings.MediaSize = CoreWebView2PrintMediaSize.Custom;
            settings.PageWidth = A4WidthInches;
            settings.PageHeight = A4HeightInches;
            settings.ScaleFactor = 1.0;
            settings.MarginTop = 0;
            settings.MarginRight = 0;
            settings.MarginBottom = 0;
            settings.MarginLeft = 0;
            settings.PageRanges = "1";
            settings.PagesPerSide = 1;
            settings.ColorMode = CoreWebView2PrintColorMode.Color;
            settings.Duplex = CoreWebView2PrintDuplex.OneSided;
            settings.ShouldPrintBackgrounds = true;
            settings.ShouldPrintHeaderAndFooter = false;

            var result = await webView.CoreWebView2.PrintAsync(settings);
            if (result != CoreWebView2PrintStatus.Succeeded) throw new InvalidOperationException($"Windows returned {result}.");
            MessageBox.Show("The one-page A4 photo sheet was sent to the printer.", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Close();
        }
        catch (Exception error)
        {
            statusLabel.Text = "Printing failed. Check the printer and try again.";
            MessageBox.Show($"The photo sheet could not print.\n\n{error.Message}", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
            printButton.Enabled = true;
            propertiesButton.Enabled = true;
        }
    }

    private async void OnShown(object? sender, EventArgs e)
    {
        try
        {
            await webView.EnsureCoreWebView2Async();
            var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            void Completed(object? _, CoreWebView2NavigationCompletedEventArgs args)
            {
                webView.NavigationCompleted -= Completed;
                if (args.IsSuccess) ready.TrySetResult();
                else ready.TrySetException(new InvalidOperationException($"PDF preview failed: {args.WebErrorStatus}"));
            }
            webView.NavigationCompleted += Completed;
            webView.Source = new Uri(pdfPath);
            await ready.Task;
            printButton.Enabled = printerList.Items.Count > 0;
            statusLabel.Text = "Ready - A4 portrait - Actual size - 1 page";
        }
        catch (Exception error)
        {
            MessageBox.Show($"The PDF preview could not open.\n\n{error.Message}", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }
}
