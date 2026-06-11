// {{PROJECT_NAME}}
// {{DESCRIPTION}}

namespace {{NAMESPACE}};

class Program
{
    static void Main(string[] args)
    {
        var name = args.Length > 0 ? args[0] : "world";
        Console.WriteLine(Hello(name));
    }

    public static string Hello(string name)
    {
        return $"Hello, {name} from {{PROJECT_NAME}}!";
    }
}
