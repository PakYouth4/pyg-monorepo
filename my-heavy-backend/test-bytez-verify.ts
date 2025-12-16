// Bytez API Model Verification
// Run with: npx ts-node test-bytez-verify.ts

import Bytez from "bytez.js";

const key = "30c50429018f8d11e52d3b75503d170a";
const sdk = new Bytez(key);

const modelsToTest = [
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "openai/gpt-4o-mini",
];

async function verifyModel(modelName: string): Promise<void> {
    try {
        console.log(`\n🔍 Verifying: ${modelName}...`);
        const model = sdk.model(modelName);

        const { error, output } = await model.run([
            {
                role: "user",
                content: "What is your exact model name and version? Also, what company created you? Answer in exactly one sentence."
            }
        ]);

        if (error) {
            console.log(`  ❌ Error: ${error}`);
        } else {
            console.log(`  📝 Response: ${JSON.stringify(output.content || output)}`);
        }
    } catch (e: any) {
        console.log(`  ❌ Exception: ${e.message}`);
    }
}

async function main() {
    console.log("=== Bytez Model Verification Test ===");
    console.log("Asking each model to identify itself...\n");

    for (const model of modelsToTest) {
        await verifyModel(model);
    }

    console.log("\n=== Verification Complete ===");
}

main();
