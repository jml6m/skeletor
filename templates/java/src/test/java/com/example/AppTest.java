package com.example;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AppTest {

    @Test
    void helloReturnsGreeting() {
        assertEquals("Hello, tester from {{PROJECT_NAME}}!", App.hello("tester"));
    }
}
