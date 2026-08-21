using System.Net;
using System.Net.Sockets;

namespace CJNET.PrintHelper;

internal static class OriginPolicy
{
    internal static bool IsAllowed(string? origin)
    {
        if (origin is null || !Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme == Uri.UriSchemeHttps) return true;
        if (uri.Scheme != Uri.UriSchemeHttp) return false;
        if (uri.IsLoopback) return true;
        return IPAddress.TryParse(uri.Host, out var address) && IsPrivateAddress(address);
    }

    private static bool IsPrivateAddress(IPAddress address)
    {
        if (address.AddressFamily != AddressFamily.InterNetwork) return false;
        var bytes = address.GetAddressBytes();
        return bytes[0] == 10 ||
               (bytes[0] == 172 && bytes[1] is >= 16 and <= 31) ||
               (bytes[0] == 192 && bytes[1] == 168);
    }
}
