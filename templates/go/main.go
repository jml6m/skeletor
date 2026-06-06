package main

import (
	"fmt"
	"os"
)

// main is the entry point for {{PROJECT_NAME}}.
func main() {
	name := "world"
	if len(os.Args) > 1 {
		name = os.Args[1]
	}
	fmt.Println(hello(name))
}

// hello returns a greeting. Extracted for easy testing.
func hello(name string) string {
	return fmt.Sprintf("Hello, %s from {{PROJECT_NAME}}!", name)
}
