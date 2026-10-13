using Xunit;

namespace {{CSHARP_NAMESPACE}}.Tests;

public class ProgramTests
{
    [Fact]
    public void Hello_ReturnsGreeting()
    {
        Assert.Equal("Hello, tester from {{PROJECT_NAME}}!", Program.Hello("tester"));
    }
}
