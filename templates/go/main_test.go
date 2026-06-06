package main

import "testing"

func TestHello(t *testing.T) {
	got := hello("tester")
	want := "Hello, tester from {{PROJECT_NAME}}!"
	if got != want {
		t.Errorf("hello() = %q, want %q", got, want)
	}
}
