// Bytez API Model Tester
// Run with: npx ts-node test-bytez.ts

import Bytez from "bytez.js";

const key = "30c50429018f8d11e52d3b75503d170a";
const sdk = new Bytez(key);

const modelsToTest = [
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "anthropic/claude-opus-4-5",
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash",
    "meta/llama-3-70b",
];

async function testModel(modelName: string): Promise<void> {
    try {
        console.log(`\nTesting: ${modelName}...`);
        const model = sdk.model(modelName);
        const { error, output } = await model.run([
            { role: "user", content: "Say 'Hello' and nothing else." }
        ]);

        if (error) {
            console.log(`  ❌ Error: ${error}`);
        } else {
            console.log(`  ✅ Works! Response: ${JSON.stringify(output).substring(0, 100)}`);
        }
    } catch (e: any) {
        console.log(`  ❌ Exception: ${e.message}`);
    }
}

async function main() {
    console.log("=== Bytez API Model Tester ===\n");
    console.log(`API Key: ${key.substring(0, 8)}...`);

    for (const model of modelsToTest) {
        await testModel(model);
    }

    console.log("\n=== Test Complete ===");
}

main();
