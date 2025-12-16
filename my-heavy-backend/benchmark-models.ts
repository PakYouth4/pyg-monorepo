// Multi-Model Benchmark Test
// Tests: Groq (Llama 3.3), Bytez GPT-4o, Gemini 2.5 Pro, GPT-4o-mini, "GPT-5"

import Bytez from "bytez.js";
import Groq from "groq-sdk";

const bytezKey = "30c50429018f8d11e52d3b75503d170a";
const groqKey = process.env.GROQ_API_KEY || "";

const bytezSdk = new Bytez(bytezKey);
const groqSdk = new Groq({ apiKey: groqKey });

const BENCHMARK_PROMPT = `You are an expert AI assistant. Answer all parts fully and explain your reasoning. Do the following in one response:

1. Factual Knowledge: Summarize the causes and effects of the French Revolution in 3 sentences.
2. Reasoning & Logic: If a train leaves City A at 60 mph and another leaves City B at 90 mph towards each other 200 miles apart, when and where do they meet? Show your work.
3. Creativity: Write a 4-line poem about AI helping humans.
4. Coding: Write a Python function that takes a list of numbers and returns only the prime numbers.
5. Common Sense / Context Understanding: If I put ice in a hot cup of coffee, what happens and why?
6. Math & Estimation: Estimate how many piano tuners are in New York City. Explain your reasoning.

Answer concisely but make sure to show your thought process.`;

interface ModelResult {
    modelId: string;
    response: string;
    error?: string;
}

async function testGroq(): Promise<ModelResult> {
    try {
        const completion = await groqSdk.chat.completions.create({
            messages: [{ role: "user", content: BENCHMARK_PROMPT }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
        });
        return {
            modelId: "groq/llama-3.3-70b",
            response: completion.choices[0]?.message?.content || ""
        };
    } catch (e: any) {
        return { modelId: "groq/llama-3.3-70b", response: "", error: e.message };
    }
}

async function testBytez(modelName: string): Promise<ModelResult> {
    try {
        const model = bytezSdk.model(modelName);
        const { error, output } = await model.run([
            { role: "user", content: BENCHMARK_PROMPT }
        ]);
        if (error) {
            return { modelId: modelName, response: "", error: String(error) };
        }
        return {
            modelId: modelName,
            response: output?.content || JSON.stringify(output)
        };
    } catch (e: any) {
        return { modelId: modelName, response: "", error: e.message };
    }
}

async function main() {
    console.log("=== Multi-Model Benchmark ===\n");
    console.log("Running benchmark prompt against 4 models...\n");

    const results: ModelResult[] = [];

    // Test 1: Groq
    console.log("Testing Model 1...");
    results.push(await testGroq());

    // Test 2: Bytez GPT-4o
    console.log("Testing Model 2...");
    results.push(await testBytez("openai/gpt-4o"));

    // Test 3: Bytez Gemini 2.5 Pro
    console.log("Testing Model 3...");
    results.push(await testBytez("google/gemini-2.5-pro"));

    // Test 4: Bytez GPT-4o-mini
    console.log("Testing Model 4...");
    results.push(await testBytez("openai/gpt-4o-mini"));

    console.log("\n=== RESULTS ===\n");

    // Shuffle for anonymity (but we'll keep track)
    const shuffled = [...results].sort(() => Math.random() - 0.5);
    const mapping: Record<string, string> = {};

    shuffled.forEach((r, i) => {
        const label = `Model ${i + 1}`;
        mapping[label] = r.modelId;

        console.log(`\n${"=".repeat(60)}`);
        console.log(`${label}`);
        console.log(`${"=".repeat(60)}`);

        if (r.error) {
            console.log(`ERROR: ${r.error}`);
        } else {
            console.log(r.response);
        }
    });

    console.log("\n\n=== MODEL MAPPING (REVEAL) ===\n");
    Object.entries(mapping).forEach(([label, modelId]) => {
        console.log(`${label} = ${modelId}`);
    });
}

main();
