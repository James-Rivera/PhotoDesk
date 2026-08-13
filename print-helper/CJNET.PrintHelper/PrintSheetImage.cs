using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

namespace CJNET.PrintHelper;

internal static class PrintSheetImage
{
    internal const int WidthPixels = 2480;
    internal const int HeightPixels = 3508;
    private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    internal static void Validate(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < PngSignature.Length || !bytes[..PngSignature.Length].SequenceEqual(PngSignature))
            throw new InvalidDataException("The print sheet is not a valid PNG image.");

        try
        {
            using var stream = new MemoryStream(bytes.ToArray(), writable: false);
            using var image = Image.FromStream(stream, useEmbeddedColorManagement: true, validateImageData: true);
            if (image.RawFormat.Guid != ImageFormat.Png.Guid)
                throw new InvalidDataException("The print sheet is not a valid PNG image.");
            if (image.Width != WidthPixels || image.Height != HeightPixels)
                throw new InvalidDataException($"The print sheet must be exactly {WidthPixels} × {HeightPixels} pixels for A4 at 300 DPI.");
        }
        catch (InvalidDataException)
        {
            throw;
        }
        catch (Exception error) when (error is ArgumentException or OutOfMemoryException)
        {
            throw new InvalidDataException("The print sheet PNG is damaged or unreadable.", error);
        }
    }

    internal static Bitmap Load(string path)
    {
        using var source = Image.FromFile(path, useEmbeddedColorManagement: true);
        if (source.Width != WidthPixels || source.Height != HeightPixels)
            throw new InvalidDataException($"The print sheet must be exactly {WidthPixels} × {HeightPixels} pixels.");
        return new Bitmap(source);
    }
}

internal static class NativePrintRenderer
{
    internal const float A4WidthMillimeters = 210f;
    internal const float A4HeightMillimeters = 297f;

    internal static float HundredthsOfInchToMillimeters(float value) => value * 25.4f / 100f;

    internal static void Draw(Graphics graphics, Image sheet, float hardMarginX, float hardMarginY)
    {
        var state = graphics.Save();
        try
        {
            graphics.PageUnit = GraphicsUnit.Millimeter;
            graphics.TranslateTransform(
                -HundredthsOfInchToMillimeters(hardMarginX),
                -HundredthsOfInchToMillimeters(hardMarginY));
            graphics.CompositingQuality = CompositingQuality.HighQuality;
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            graphics.DrawImage(
                sheet,
                new RectangleF(0, 0, A4WidthMillimeters, A4HeightMillimeters),
                new RectangleF(0, 0, sheet.Width, sheet.Height),
                GraphicsUnit.Pixel);
        }
        finally
        {
            graphics.Restore(state);
        }
    }
}
