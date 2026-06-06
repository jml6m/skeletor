using Xunit;

namespace {{PROJECT_NAME | replace('-', '_')}};

public class ProgramTests
{
    [Fact]
    public void Hello_ReturnsGreeting()
    {
        Assert.Equal("Hello, tester from {{PROJECT_NAME}}!", Program.Hello("tester"));
    }
}
