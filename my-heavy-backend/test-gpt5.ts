// Test GPT-5 claim on Bytez

import Bytez from "bytez.js";

const key = "30c50429018f8d11e52d3b75503d170a";
const sdk = new Bytez(key);

async function testGPT5() {
    console.log("=== Testing 'GPT-5' on Bytez ===\n");

    try {
        const model = sdk.model("openai/gpt-5");

        // Test 1: Simple hello
        console.log("Test 1: Simple hello...");
        const { error, output } = await model.run([
            { role: "user", content: "Hello" }
        ]);

        if (error) {
            console.log(`Error: ${error}`);
            return;
        }

        console.log(`Response: ${JSON.stringify(output)}\n`);

        // Test 2: Ask it to identify itself
        console.log("Test 2: Asking for identity...");
        const { error: e2, output: o2 } = await model.run([
            { role: "user", content: "What is your exact model name, version, and release date? Be very specific." }
        ]);

        if (e2) {
            console.log(`Error: ${e2}`);
            return;
        }

        console.log(`Identity Response: ${JSON.stringify(o2.content || o2)}`);

    } catch (e: any) {
        console.log(`Exception: ${e.message}`);
    }
}

testGPT5();
