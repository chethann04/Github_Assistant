import os
import sys
import json
import chromadb

def inspect_dir(persist_dir):
    abs_path = os.path.abspath(persist_dir)
    print(f"\n=======================================================")
    print(f"[CHROMA AUDIT] INSPECTING CHROMADB AT: {abs_path}")
    print(f"=======================================================")
    if not os.path.exists(abs_path):
        print(f"Directory {abs_path} does not exist.")
        return

    try:
        client = chromadb.PersistentClient(path=abs_path)
        collections = client.list_collections()
        print(f"Found {len(collections)} collections:")
        for col in collections:
            print(f"- Collection Name: {col.name} | Total Vectors: {col.count()}")

            # Get all records
            all_data = col.get(include=['embeddings', 'metadatas', 'documents'])
            ids = all_data.get('ids', [])
            embeddings = all_data.get('embeddings', [])
            metadatas = all_data.get('metadatas', [])
            documents = all_data.get('documents', [])

            print(f"  Total records fetched: {len(ids)}")
            if len(embeddings) > 0 and embeddings[0] is not None:
                dim = len(embeddings[0])
                print(f"  Vector Dimensionality: {dim}")

                real_vectors = 0
                fallback_vectors = 0
                for vec in embeddings:
                    # Deterministic hash vectors have >70% zeros
                    zeros = sum(1 for v in vec if v == 0.0)
                    if zeros / len(vec) > 0.7:
                        fallback_vectors += 1
                    else:
                        real_vectors += 1

                print(f"  Real Gemini Continuous Vectors: {real_vectors} ({real_vectors/len(embeddings)*100:.1f}%)")
                print(f"  Deterministic Fallback Vectors: {fallback_vectors} ({fallback_vectors/len(embeddings)*100:.1f}%)")
                print(f"  Are Real and Fallback Mixed?: {'YES' if real_vectors > 0 and fallback_vectors > 0 else 'NO'}")

            # Group by repositoryId
            repos = {}
            for i, meta in enumerate(metadatas):
                rid = meta.get('repositoryId', 'UNKNOWN') if meta else 'UNKNOWN'
                fp = meta.get('filePath', 'UNKNOWN') if meta else 'UNKNOWN'
                if rid not in repos:
                    repos[rid] = set()
                repos[rid].add(fp)

            for rid, files in repos.items():
                print(f"\n  Repository ID: {rid}")
                print(f"  Total Distinct Files: {len(files)}")
                for ef in ['package.json', 'src/App.tsx', 'download_cli.js', 'eslint.config.js']:
                    matching = [f for f in files if f == ef or f.endswith(ef)]
                    print(f"    Expected File: '{ef}' -> Indexed in Chroma: {'YES' if matching else 'NO'} ({len(matching)} matches)")

    except Exception as e:
        print(f"Error inspecting {abs_path}: {e}")

inspect_dir("./data/chroma")
inspect_dir("./apps/backend/data/chroma")
