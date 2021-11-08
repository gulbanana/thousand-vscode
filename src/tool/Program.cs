using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using NuGet.Common;
using NuGet.Configuration;
using NuGet.Packaging;
using NuGet.Packaging.Signing;
using NuGet.Protocol;
using NuGet.Protocol.Core.Types;
using NuGet.Versioning;

class Program
{
    static async Task Main(string[] args)
    {
        var storagePath = args[0];
        var logger = new StderrLogger(LogLevel.Debug);
        var settings = Settings.LoadDefaultSettings(root: null);        
        
        var cacheContext = new SourceCacheContext();
        var policyContext = ClientPolicyContext.GetClientPolicy(settings, logger);
        var extractionContext = new PackageExtractionContext(PackageSaveMode.Defaultv3, XmlDocFileSaveMode.None, policyContext, logger);
        
        PackageReaderBase packageReader = default;
        NuGetVersion currentVersion;

        var serverDirectory = Path.GetFullPath(Path.Combine(storagePath, "Thousand.LSP"));
        if (Directory.Exists(serverDirectory))
        {
            logger.LogVerbose($"{serverDirectory} found.");
            packageReader = new PackageFolderReader(serverDirectory);
            currentVersion = packageReader.GetIdentity().Version;
            logger.LogVerbose($"Found v{currentVersion}. Checking for updates...");
        }
        else
        {
            logger.LogVerbose($"{serverDirectory} not found.");
            currentVersion = new NuGetVersion(0, 0, 1); 
        }

        var repository = Repository.Factory.GetCoreV3("https://api.nuget.org/v3/index.json");

        var packageMetadata = await repository.GetResourceAsync<PackageMetadataResource>();
        var metadata = await packageMetadata.GetMetadataAsync("Thousand.LSP", false, false, cacheContext, logger, CancellationToken.None);        
        var package = metadata.LastOrDefault(p => p.Identity.Version > currentVersion);
        
        if (package == null)
        {
            if (!Directory.Exists(serverDirectory))
            {
                logger.LogError("No versions found.");
                return;
            }
            else
            {
                logger.LogVerbose("No update found.");
            }
        }
        else
        {        
            logger.LogVerbose($"Downloading {package.Identity}.nupkg.");
            var download = await repository.GetResourceAsync<DownloadResource>();
            var downloadResult = await download.GetDownloadResourceResultAsync(
                package.Identity,
                new PackageDownloadContext(cacheContext),
                SettingsUtility.GetGlobalPackagesFolder(settings),
                logger, 
                CancellationToken.None
            );

            if (Directory.Exists(serverDirectory))
            {
                Directory.Delete(serverDirectory, true);
            }

            await PackageExtractor.ExtractPackageAsync(
                downloadResult.PackageSource,
                downloadResult.PackageStream,
                new PackagePathResolver(Path.GetFullPath(storagePath), false),
                extractionContext,
                CancellationToken.None
            );

            packageReader = downloadResult.PackageReader;
        }

        var binary = packageReader.GetToolItems().SelectMany(tfm => tfm.Items).Where(i => i.EndsWith("Thousand.LSP.dll")).Single();
        Console.Write(Path.GetFullPath(Path.Combine(serverDirectory, binary)));
    }
}
