using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;

namespace CJNET.PrintHelper;

internal sealed class PrintWindow : Form
{
    private readonly Bitmap sheetImage;
    private readonly SheetPreviewControl preview;
    private readonly ComboBox printerList = new() { DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly NumericUpDown copies = new() { Minimum = 1, Maximum = 99, Value = 1 };
    private readonly Button propertiesButton = new() { Text = "Printer settings…" };
    private readonly Button printButton = new() { Text = "Print" };
    private readonly Label statusLabel = new();

    public PrintWindow(string sheetPath)
    {
        sheetImage = PrintSheetImage.Load(sheetPath);
        preview = new SheetPreviewControl(sheetImage);

        Text = "CJNET PhotoDesk — Print";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Width = 1100;
        Height = 760;
        MinimumSize = new Size(900, 620);
        StartPosition = FormStartPosition.CenterScreen;
        ShowInTaskbar = true;
        BackColor = Color.FromArgb(245, 241, 232);
        Font = new Font("Segoe UI", 9f);

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            Padding = new Padding(12),
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 300));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.Controls.Add(BuildPreview(), 0, 0);
        layout.Controls.Add(BuildControls(), 1, 0);
        Controls.Add(layout);

        LoadPrinters();
        printerList.SelectedIndexChanged += (_, _) => UpdatePrinterState();
        propertiesButton.Click += (_, _) => OpenPrinterProperties();
        printButton.Click += (_, _) => Print();
        Shown += (_, _) => preview.FitPage();
    }

    private Control BuildPreview()
    {
        var container = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Color.FromArgb(55, 55, 55),
            Margin = new Padding(0),
        };
        container.RowStyles.Add(new RowStyle(SizeType.Absolute, 44));
        container.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var toolbar = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            Padding = new Padding(9, 7, 9, 5),
            BackColor = Color.FromArgb(245, 241, 232),
        };
        var fitButton = ToolbarButton("Fit page", 78);
        var zoomOut = ToolbarButton("−", 34);
        var zoomLabel = new Label
        {
            AutoSize = false,
            Width = 50,
            Height = 28,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.FromArgb(70, 70, 70),
        };
        var zoomIn = ToolbarButton("+", 34);
        fitButton.Click += (_, _) => preview.FitPage();
        zoomOut.Click += (_, _) => preview.ChangeZoom(-0.1f);
        zoomIn.Click += (_, _) => preview.ChangeZoom(0.1f);
        preview.ZoomChanged += (_, _) => zoomLabel.Text = $"{Math.Round(preview.Zoom * 100)}%";
        toolbar.Controls.Add(fitButton);
        toolbar.Controls.Add(zoomOut);
        toolbar.Controls.Add(zoomLabel);
        toolbar.Controls.Add(zoomIn);

        container.Controls.Add(toolbar, 0, 0);
        container.Controls.Add(preview, 0, 1);
        return container;
    }

    private Control BuildControls()
    {
        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            RowCount = 2,
            ColumnCount = 1,
            Padding = new Padding(22, 18, 8, 8),
            BackColor = Color.FromArgb(245, 241, 232),
        };
        panel.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        panel.RowStyles.Add(new RowStyle(SizeType.Absolute, 164));

        var fields = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            ColumnCount = 1,
            RowCount = 7,
        };
        fields.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        fields.Controls.Add(FieldLabel("Printer"));
        fields.Controls.Add(printerList);
        fields.Controls.Add(propertiesButton);
        fields.Controls.Add(Spacer(18));
        fields.Controls.Add(FieldLabel("Copies"));
        fields.Controls.Add(copies);
        fields.Controls.Add(Spacer(8));

        printerList.Dock = DockStyle.Top;
        printerList.Height = 34;
        printerList.Margin = new Padding(0, 5, 0, 10);
        copies.Dock = DockStyle.Top;
        copies.Height = 34;
        copies.Margin = new Padding(0, 5, 0, 0);
        StyleSecondaryButton(propertiesButton, 40);

        var actions = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
        };
        actions.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
        actions.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        actions.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));

        statusLabel.Dock = DockStyle.Fill;
        statusLabel.Text = "A4 · Portrait · Actual size";
        statusLabel.ForeColor = Color.FromArgb(95, 90, 78);
        statusLabel.TextAlign = ContentAlignment.MiddleLeft;

        printButton.Dock = DockStyle.Fill;
        printButton.Height = 48;
        printButton.BackColor = Color.FromArgb(244, 212, 0);
        printButton.ForeColor = Color.FromArgb(23, 23, 23);
        printButton.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
        printButton.FlatStyle = FlatStyle.Flat;
        printButton.FlatAppearance.BorderSize = 0;
        printButton.Margin = new Padding(0, 0, 0, 6);

        var cancelButton = new Button { Text = "Cancel", Dock = DockStyle.Fill, DialogResult = DialogResult.Cancel };
        StyleSecondaryButton(cancelButton, 38);
        cancelButton.Click += (_, _) => Close();

        actions.Controls.Add(statusLabel, 0, 0);
        actions.Controls.Add(printButton, 0, 1);
        actions.Controls.Add(cancelButton, 0, 2);
        panel.Controls.Add(fields, 0, 0);
        panel.Controls.Add(actions, 0, 1);

        AcceptButton = printButton;
        CancelButton = cancelButton;
        return panel;
    }

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
        UpdatePrinterState();
    }

    private void UpdatePrinterState()
    {
        var hasPrinter = printerList.SelectedItem is string;
        propertiesButton.Enabled = hasPrinter;
        printButton.Enabled = hasPrinter;
        if (!hasPrinter) statusLabel.Text = "No Windows printers were found.";
        else statusLabel.Text = "A4 · Portrait · Actual size";
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
            statusLabel.Text = "Close Printer settings before selecting Print.";
        }
        catch (Exception error)
        {
            MessageBox.Show($"Printer settings could not open.\n\n{error.Message}", "CJNET Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void Print()
    {
        if (printerList.SelectedItem is not string printerName) return;
        printButton.Enabled = false;
        propertiesButton.Enabled = false;
        statusLabel.Text = "Sending the A4 sheet to Windows…";
        Refresh();

        try
        {
            using var document = CreatePrintDocument(printerName, (short)copies.Value);
            document.PrintPage += (_, eventArgs) =>
            {
                var graphics = eventArgs.Graphics ?? throw new InvalidOperationException("Windows did not provide a printer drawing surface.");
                NativePrintRenderer.Draw(graphics, sheetImage, eventArgs.PageSettings.HardMarginX, eventArgs.PageSettings.HardMarginY);
                eventArgs.HasMorePages = false;
            };
            document.Print();
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

    private static PrintDocument CreatePrintDocument(string printerName, short copyCount)
    {
        var settings = new PrinterSettings
        {
            PrinterName = printerName,
            Copies = copyCount,
            Duplex = Duplex.Simplex,
        };
        if (!settings.IsValid) throw new InvalidOperationException("Windows reports that this printer is unavailable.");

        var a4 = settings.PaperSizes.Cast<PaperSize>().FirstOrDefault(size => size.Kind == PaperKind.A4)
            ?? settings.PaperSizes.Cast<PaperSize>().FirstOrDefault(size =>
                Math.Abs(size.Width - 827) <= 2 && Math.Abs(size.Height - 1169) <= 2);
        if (a4 is null) throw new InvalidOperationException("The selected printer does not report an A4 paper size. Add A4 in Printer settings and try again.");

        var document = new PrintDocument
        {
            DocumentName = "CJNET PhotoDesk A4 Photo Sheet",
            PrinterSettings = settings,
            OriginAtMargins = false,
            PrintController = new StandardPrintController(),
        };
        document.DefaultPageSettings.PaperSize = a4;
        document.DefaultPageSettings.Landscape = false;
        document.DefaultPageSettings.Color = true;
        document.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
        return document;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) sheetImage.Dispose();
        base.Dispose(disposing);
    }

    private static Label FieldLabel(string text) => new()
    {
        Text = text,
        AutoSize = true,
        Font = new Font("Segoe UI", 9f, FontStyle.Bold),
        ForeColor = Color.FromArgb(23, 23, 23),
        Margin = new Padding(0),
    };

    private static Control Spacer(int height) => new Panel { Height = height, Dock = DockStyle.Top };

    private static Button ToolbarButton(string text, int width)
    {
        var button = new Button { Text = text, Width = width, Height = 28, Margin = new Padding(0, 0, 6, 0) };
        StyleSecondaryButton(button, 28);
        return button;
    }

    private static void StyleSecondaryButton(Button button, int height)
    {
        button.Height = height;
        button.Dock = DockStyle.Top;
        button.FlatStyle = FlatStyle.Flat;
        button.FlatAppearance.BorderColor = Color.FromArgb(205, 198, 179);
        button.BackColor = Color.White;
        button.ForeColor = Color.FromArgb(23, 23, 23);
        button.Margin = new Padding(0, 0, 0, 6);
    }
}

internal sealed class SheetPreviewControl : ScrollableControl
{
    private const int PagePadding = 20;
    private readonly Image image;
    private float zoom = 0.2f;
    private bool fitToWindow = true;

    internal event EventHandler? ZoomChanged;
    internal float Zoom => zoom;

    internal SheetPreviewControl(Image image)
    {
        this.image = image;
        Dock = DockStyle.Fill;
        AutoScroll = true;
        BackColor = Color.FromArgb(55, 55, 55);
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
    }

    internal void FitPage()
    {
        fitToWindow = true;
        AutoScrollPosition = Point.Empty;
        RecalculateZoom();
    }

    internal void ChangeZoom(float delta)
    {
        fitToWindow = false;
        zoom = Math.Clamp(zoom + delta, 0.1f, 1.5f);
        UpdateScrollArea();
        ZoomChanged?.Invoke(this, EventArgs.Empty);
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (fitToWindow) RecalculateZoom();
    }

    protected override void OnMouseWheel(MouseEventArgs e)
    {
        if ((ModifierKeys & Keys.Control) == Keys.Control)
        {
            ChangeZoom(e.Delta > 0 ? 0.1f : -0.1f);
            return;
        }
        base.OnMouseWheel(e);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var width = Math.Max(1, (int)Math.Round(image.Width * zoom));
        var height = Math.Max(1, (int)Math.Round(image.Height * zoom));
        var x = width + PagePadding * 2 <= ClientSize.Width
            ? (ClientSize.Width - width) / 2
            : PagePadding + AutoScrollPosition.X;
        var y = height + PagePadding * 2 <= ClientSize.Height
            ? (ClientSize.Height - height) / 2
            : PagePadding + AutoScrollPosition.Y;

        e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
        using var shadowBrush = new SolidBrush(Color.FromArgb(40, 0, 0, 0));
        e.Graphics.FillRectangle(shadowBrush, x + 5, y + 5, width, height);
        e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        e.Graphics.DrawImage(image, new Rectangle(x, y, width, height));
        e.Graphics.DrawRectangle(Pens.DimGray, x, y, width - 1, height - 1);
    }

    private void RecalculateZoom()
    {
        if (ClientSize.Width <= PagePadding * 2 || ClientSize.Height <= PagePadding * 2) return;
        zoom = Math.Clamp(Math.Min(
            (ClientSize.Width - PagePadding * 2f) / image.Width,
            (ClientSize.Height - PagePadding * 2f) / image.Height), 0.1f, 1.5f);
        UpdateScrollArea();
        ZoomChanged?.Invoke(this, EventArgs.Empty);
    }

    private void UpdateScrollArea()
    {
        AutoScrollMinSize = new Size(
            (int)Math.Round(image.Width * zoom) + PagePadding * 2,
            (int)Math.Round(image.Height * zoom) + PagePadding * 2);
        Invalidate();
    }
}
