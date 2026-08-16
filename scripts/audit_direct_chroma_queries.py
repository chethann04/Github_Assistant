import os
import sys
import json
import chromadb
from google import genai

def audit_queries():
    # Connect directly to backend's active ChromaDB persist directory
    persist_dir = os.path.abspath("./apps/backend/data/chroma")
    print(f"Connecting to ChromaDB at: {persist_dir}")
    client = chromadb.PersistentClient(path=persist_dir)
    col = client.get_collection("repo_chunks")

    repo_id = "ffe62d42-22f4-41f8-b108-958082583ef0"

    # 6 Benchmark Questions from evaluation suite
    questions = [
        {
            "id": 1,
            "question": "What are the core dependencies and runtime scripts configured for LIT-WEBSITE?",
            "expectedFiles": ["package.json"]
        },
        {
            "id": 2,
            "question": "Where is the primary application entry point and root mounting configured?",
            "expectedFiles": ["src/App.tsx"]
        },
        {
            "id": 3,
            "question": "How is download_cli logic and state management implemented in download_cli.js?",
            "expectedFiles": ["download_cli.js"]
        },
        {
            "id": 4,
            "question": "What methods handle eslint rendering or event updates in eslint.config.js?",
            "expectedFiles": ["eslint.config.js"]
        },
        {
            "id": 5,
            "question": "How does data flow from src/App.tsx into the download_cli.js processing components?",
            "expectedFiles": ["src/App.tsx", "download_cli.js"]
        },
        {
            "id": 6,
            "question": "Explain the complete lifecycle and algorithm flow in LIT-WEBSITE, including state initialization, verification checks, and UI feedback.",
            "expectedFiles": ["src/App.tsx", "download_cli.js", "eslint.config.js"]
        }
    ]

    # Initialize Gemini Embedding client
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    ai = genai.Client(api_key=gemini_key)

    print("\n=======================================================")
    print("DIRECT RETRIEVAL DIAGNOSTICS (TOP-10 PER QUESTION)")
    print("=======================================================\n")

    for q in questions:
        print("-------------------------------------------------------")
        print(f"Question {q['id']}: {q['question']}")
        print(f"Expected Files: {q['expectedFiles']}")

        # Generate real Gemini embedding
        try:
            res = ai.models.embed_content(
                model="gemini-embedding-2",
                contents=q["question"],
                config={"output_dimensionality": 1536}
            )
            query_vec = res.embedding.values if hasattr(res, 'embedding') else res.values
            print(f"Query Vector: Real Gemini continuous ({len(query_vec)} dims)")
        except Exception as e:
            print(f"Gemini API Query Embedding failed ({e}), using fallback vector")
            # fallback vector
            query_vec = [0.0] * 1536

        # Query ChromaDB with cosine space
        search_res = col.query(
            query_embeddings=[query_vec],
            n_results=10,
            where={"repositoryId": repo_id},
            include=["metadatas", "documents", "distances"]
        )

        ids = search_res.get("ids", [[]])[0]
        distances = search_res.get("distances", [[]])[0]
        metadatas = search_res.get("metadatas", [[]])[0]

        print(f"ChromaDB Top-10 Retrieval Results ({len(ids)} found):")
        for i in range(len(ids)):
            meta = metadatas[i] if i < len(metadatas) else {}
            fp = meta.get("filePath", "unknown")
            s_line = meta.get("startLine", 1)
            e_line = meta.get("endLine", 1)
            dist = distances[i] if i < len(distances) else 0.0
            # similarity = 1 - (dist / 2)
            sim = max(0.0, min(1.0, 1.0 - (dist / 2.0)))

            is_match = any(fp == ef or fp.endswith(ef) for ef in q["expectedFiles"])
            hit_str = " [HIT]" if is_match else ""
            print(f"  {i+1}. {fp} [similarity: {sim:.4f}, dist: {dist:.4f}] (Lines {s_line}-{e_line}){hit_str}")

audit_queries()
