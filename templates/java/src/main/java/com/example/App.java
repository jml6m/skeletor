package com.example;

/**
 * {{PROJECT_NAME}}
 *
 * {{DESCRIPTION}}
 */
public class App {
    public static void main(String[] args) {
        System.out.println(hello("world"));
    }

    public static String hello(String name) {
        return String.format("Hello, %s from {{PROJECT_NAME}}!", name);
    }
}
