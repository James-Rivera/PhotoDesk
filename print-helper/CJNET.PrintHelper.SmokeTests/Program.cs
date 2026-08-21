using System.Drawing.Imaging;
using CJNET.PrintHelper;

var failures = new List<string>();
Run("accepts an exact 300 DPI A4 PNG", ValidateExactA4Png);
Run("rejects a non-PNG payload", RejectNonPng);
Run("rejects the wrong raster dimensions", RejectWrongDimensions);
Run("maps the full raster to a physical A4 page", RenderA4WithoutPrinter);
Run("converts printer hard margins to millimetres", ValidateHardMarginConversion);
Run("allows loopback and private branch origins only over HTTP", ValidateOriginPolicy);

if (failures.Count > 0)
{
    Console.Error.WriteLine($"{failures.Count} native print simulation test(s) failed:");
    foreach (var failure in failures) Console.Error.WriteLine($"- {failure}");
    return 1;
}

Console.WriteLine("6 native print simulation tests passed without a physical printer.");
return 0;

void Run(string name, Action test)
{
    try
    {
        test();
        Console.WriteLine($"PASS {name}");
    }
    catch (Exception error)
    {
        failures.Add($"{name}: {error.Message}");
    }
}

static void ValidateExactA4Png()
{
    using var sheet = CreateSheet();
    PrintSheetImage.Validate(ToPngBytes(sheet));
}

static void RejectNonPng()
{
    AssertThrows<InvalidDataException>(() => PrintSheetImage.Validate("not a PNG"u8.ToArray()));
}

static void RejectWrongDimensions()
{
    using var wrongSize = new Bitmap(100, 100);
    AssertThrows<InvalidDataException>(() => PrintSheetImage.Validate(ToPngBytes(wrongSize)));
}

static void RenderA4WithoutPrinter()
{
    using var sheet = CreateSheet();
    using var simulatedPage = new Bitmap(2100, 2970, PixelFormat.Format24bppRgb);
    simulatedPage.SetResolution(254, 254); // 10 pixels per millimetre.
    using (var graphics = Graphics.FromImage(simulatedPage))
    {
        graphics.Clear(Color.Magenta);
        NativePrintRenderer.Draw(graphics, sheet, 0, 0);
    }

    AssertColor(Color.Red, simulatedPage.GetPixel(250, 250), "The 2×2-inch marker was not rendered at the page origin.");
    AssertColor(Color.White, simulatedPage.GetPixel(1000, 1000), "The white A4 page did not cover the simulated print surface.");
}

static void ValidateHardMarginConversion()
{
    var millimetres = NativePrintRenderer.HundredthsOfInchToMillimeters(25);
    if (Math.Abs(millimetres - 6.35f) > 0.0001f)
        throw new InvalidOperationException($"Expected 6.35 mm but got {millimetres} mm.");
}

static void ValidateOriginPolicy()
{
    if (!OriginPolicy.IsAllowed("http://127.0.0.1:3210")) throw new InvalidOperationException("Loopback origin was rejected.");
    if (!OriginPolicy.IsAllowed("http://192.168.10.4:3210")) throw new InvalidOperationException("Private branch origin was rejected.");
    if (!OriginPolicy.IsAllowed("http://10.0.0.8:3210")) throw new InvalidOperationException("Private 10/8 origin was rejected.");
    if (OriginPolicy.IsAllowed("http://8.8.8.8:3210")) throw new InvalidOperationException("Public HTTP origin was allowed.");
    if (OriginPolicy.IsAllowed("http://photodesk.example.com")) throw new InvalidOperationException("Arbitrary HTTP hostname was allowed.");
}

static Bitmap CreateSheet()
{
    var sheet = new Bitmap(PrintSheetImage.WidthPixels, PrintSheetImage.HeightPixels, PixelFormat.Format24bppRgb);
    using var graphics = Graphics.FromImage(sheet);
    graphics.Clear(Color.White);
    graphics.FillRectangle(Brushes.Red, 0, 0, 600, 600);
    return sheet;
}

static byte[] ToPngBytes(Image image)
{
    using var stream = new MemoryStream();
    image.Save(stream, ImageFormat.Png);
    return stream.ToArray();
}

static void AssertThrows<T>(Action action) where T : Exception
{
    try
    {
        action();
    }
    catch (T)
    {
        return;
    }
    throw new InvalidOperationException($"Expected {typeof(T).Name}.");
}

static void AssertColor(Color expected, Color actual, string message)
{
    if (expected.ToArgb() != actual.ToArgb())
        throw new InvalidOperationException($"{message} Expected {expected}, got {actual}.");
}
