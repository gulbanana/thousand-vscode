using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using NuGet.Common;
using NuGet.Packaging.Core;
using NuGet.Protocol;
using NuGet.Protocol.Core.Types;

class Program
{
    static async Task Main(string[] args)
    {
        var storagePath = args[0];
        Console.WriteLine($"Updating {args[0]}.");

        var logger = NullLogger.Instance;
        var cache = new SourceCacheContext();
        var repository = Repository.Factory.GetCoreV3("https://api.nuget.org/v3/index.json");
        var packageMetadata = await repository.GetResourceAsync<PackageMetadataResource>();
        var findPackageById = await repository.GetResourceAsync<FindPackageByIdResource>();

        // var metadata = await packageMetadata.GetMetadataAsync("Thousand.LSP", false, false, cache, logger, CancellationToken.None);
        // var package = metadata.Single();

        var versions = await findPackageById.GetAllVersionsAsync("Thousand.LSP", cache, logger, CancellationToken.None);
        var latest = versions.Last(v => !v.IsPrerelease);
        Console.WriteLine($"Downloading Thousand.LSP {latest}.");
        
        var downloader = await findPackageById.GetPackageDownloaderAsync(new PackageIdentity("Thousand.LSP", latest), cache, logger, CancellationToken.None);
        await downloader.CopyNupkgFileToAsync(Path.Combine(storagePath, $"Thousand.LSP.{latest}.nupkg"), CancellationToken.None);
    }
}
