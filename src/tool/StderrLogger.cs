using System;
using System.Threading.Tasks;
using NuGet.Common;

public class StderrLogger : LoggerBase
{
    public StderrLogger(LogLevel verbosityLevel) : base(verbosityLevel) { }

    public override void Log(ILogMessage message)
    {
        Console.Error.WriteLine($"{message.Level.ToString().PadRight(12)} {message.Message}");
    }

    public override Task LogAsync(ILogMessage message)
    {
        Log(message);
        return Task.CompletedTask;
    }
}