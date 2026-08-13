using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CJNET.PrintHelper;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        using var context = new HelperContext();
        Application.Run(context);
    }
}

internal sealed class HelperContext : ApplicationContext
{
    internal const string Version = "0.1.0";
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
            Icon = SystemIcons.Application,
            Text = "CJNET Print Helper",
            Visible = true,
            ContextMenuStrip = BuildMenu(),
        };

        listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
        listener.Start();
        _ = ListenAsync();
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
        await WriteJson(context.Response, new { ok = true, message = "Windows print dialog opened." });
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

    private sealed record PairRequest(string Code);
}

internal sealed class PrintWindow : Form
{
    private readonly string pdfPath;
    private readonly WebView2 webView = new() { Dock = DockStyle.Fill };

    public PrintWindow(string pdfPath)
    {
        this.pdfPath = pdfPath;
        Text = "CJNET PhotoDesk — Print";
        Width = 980;
        Height = 760;
        StartPosition = FormStartPosition.CenterScreen;
        ShowInTaskbar = true;
        Controls.Add(webView);
        Shown += OnShown;
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
            webView.CoreWebView2.ShowPrintUI(CoreWebView2PrintDialogKind.System);
        }
        catch (Exception error)
        {
            MessageBox.Show($"The Windows print dialog could not open.\n\n{error.Message}", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }
}
