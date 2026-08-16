import os
import sys
import json
import traceback

# Ensure unbuffered standard I/O for real-time JSON-RPC communication
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(line_buffering=True)

try:
    import chromadb
    from chromadb.config import Settings
except ImportError:
    print(json.dumps({"error": "ChromaDB package is not installed. Run 'pip install chromadb'."}), file=sys.stderr)
    sys.exit(1)

_client = None
_client_path = None

def get_client(persist_dir: str):
    global _client, _client_path
    abs_path = os.path.abspath(persist_dir)
    if _client is None or _client_path != abs_path:
        os.makedirs(abs_path, exist_ok=True)
        settings = Settings(
            is_persistent=True,
            persist_directory=abs_path,
            anonymized_telemetry=False,
            allow_reset=True
        )
        _client = chromadb.PersistentClient(path=abs_path, settings=settings)
        _client_path = abs_path
    return _client

def clean_surrogates(val):
    if isinstance(val, str):
        return val.encode('utf-8', 'replace').decode('utf-8', 'replace')
    elif isinstance(val, list):
        return [clean_surrogates(item) for item in val]
    elif isinstance(val, dict):
        return {clean_surrogates(k): clean_surrogates(v) for k, v in val.items()}
    return val

def handle_command(cmd_data: dict) -> dict:
    cmd = cmd_data.get("action")
    persist_dir = cmd_data.get("persist_directory", "./data/chroma")
    collection_name = cmd_data.get("collection_name", "repo_chunks_2048")

    client = get_client(persist_dir)

    if cmd == "ping":
        return {"status": "ok", "persist_directory": _client_path, "version": chromadb.__version__}

    elif cmd == "ensure_collection":
        coll = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        return {"status": "ok", "name": coll.name, "count": coll.count()}

    elif cmd == "upsert":
        ids = cmd_data.get("ids", [])
        raw_embeddings = cmd_data.get("embeddings", [])
        documents = clean_surrogates(cmd_data.get("documents", []))
        metadatas = clean_surrogates(cmd_data.get("metadatas", []))

        if not ids:
            return {"status": "ok", "count": 0}

        embeddings = None
        if isinstance(raw_embeddings, list) and len(raw_embeddings) > 0:
            embeddings = [[float(v) for v in vec] for vec in raw_embeddings if isinstance(vec, list)]

        coll = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        # Batch upsert in chunks of 200 for stability
        batch_size = 200
        for i in range(0, len(ids), batch_size):
            coll.upsert(
                ids=ids[i:i + batch_size],
                embeddings=embeddings[i:i + batch_size] if embeddings else None,
                documents=documents[i:i + batch_size] if documents else None,
                metadatas=metadatas[i:i + batch_size] if metadatas else None
            )

        return {"status": "ok", "count": len(ids)}

    elif cmd == "search":
        raw_vector = cmd_data.get("query_vector")
        repository_id = cmd_data.get("repository_id")
        limit = int(cmd_data.get("limit", 8))
        file_path = cmd_data.get("file_path")

        if not isinstance(raw_vector, list) or len(raw_vector) == 0:
            return {"results": []}

        query_vector = [float(x) for x in raw_vector]

        coll = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        total_count = coll.count()
        if total_count == 0:
            return {"results": []}

        where_clause = {"repositoryId": repository_id}
        if file_path:
            where_clause = {
                "$and": [
                    {"repositoryId": repository_id},
                    {"filePath": file_path}
                ]
            }

        n_results = min(limit, total_count)

        try:
            query_res = coll.query(
                query_embeddings=[query_vector],
                n_results=n_results,
                where=where_clause,
                include=["metadatas", "documents", "distances"]
            )
        except Exception as e:
            return {"results": [], "warning": str(e)}

        results = []
        ids_list = query_res.get("ids", [[]])[0] if query_res.get("ids") else []
        distances = query_res.get("distances", [[]])[0] if query_res.get("distances") else []
        metadatas = query_res.get("metadatas", [[]])[0] if query_res.get("metadatas") else []
        documents = query_res.get("documents", [[]])[0] if query_res.get("documents") else []

        for i in range(len(ids_list)):
            dist = distances[i] if i < len(distances) else 0.0
            meta = metadatas[i] if i < len(metadatas) else {}
            doc = documents[i] if i < len(documents) else ""

            similarity_score = max(0.0, min(1.0, 1.0 - (dist / 2.0)))

            payload = dict(meta) if meta else {}
            payload["content"] = doc

            results.append({
                "id": str(ids_list[i]),
                "score": float(similarity_score),
                "payload": payload
            })

        # Sort descending by similarity score
        results.sort(key=lambda x: x["score"], reverse=True)
        return {"results": results}

    elif cmd == "count":
        repository_id = cmd_data.get("repository_id")
        coll = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        if repository_id:
            res = coll.get(where={"repositoryId": repository_id})
            return {"count": len(res.get("ids", []))}
        else:
            return {"count": coll.count()}

    elif cmd == "delete_repo":
        repository_id = cmd_data.get("repository_id")
        if not repository_id:
            return {"status": "ok", "repositoryId": None, "deleted": False, "deletedCount": 0, "remainingCount": 0}

        try:
            coll = client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            # Query existing IDs for this repository
            existing = coll.get(where={"repositoryId": repository_id})
            existing_ids = existing.get("ids", [])
            initial_count = len(existing_ids)

            if initial_count == 0:
                return {
                    "status": "ok",
                    "repositoryId": repository_id,
                    "deleted": False,
                    "deletedCount": 0,
                    "remainingCount": 0
                }

            # Batch delete by IDs (deterministic, stable on Windows)
            batch_size = 500
            for i in range(0, len(existing_ids), batch_size):
                coll.delete(ids=existing_ids[i:i + batch_size])

            # Verify remaining count
            check_res = coll.get(where={"repositoryId": repository_id})
            remaining = len(check_res.get("ids", []))

            return {
                "status": "ok",
                "repositoryId": repository_id,
                "deleted": True,
                "deletedCount": initial_count - remaining,
                "remainingCount": remaining
            }
        except Exception as e:
            return {
                "status": "error",
                "repositoryId": repository_id,
                "error": str(e),
                "trace": traceback.format_exc()
            }

    elif cmd == "delete_file":
        repository_id = cmd_data.get("repository_id")
        file_path = cmd_data.get("file_path")
        if not repository_id or not file_path:
            return {"status": "ok", "filePath": file_path, "deleted": False, "deletedCount": 0}

        try:
            coll = client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            existing = coll.get(where={
                "$and": [
                    {"repositoryId": repository_id},
                    {"filePath": file_path}
                ]
            })
            existing_ids = existing.get("ids", [])
            initial_count = len(existing_ids)

            if initial_count > 0:
                batch_size = 500
                for i in range(0, len(existing_ids), batch_size):
                    coll.delete(ids=existing_ids[i:i + batch_size])

            return {"status": "ok", "filePath": file_path, "deletedCount": initial_count}
        except Exception as e:
            return {"status": "error", "filePath": file_path, "error": str(e)}

    elif cmd == "purge":
        try:
            client.delete_collection(collection_name)
        except Exception:
            pass
        coll = client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        return {"status": "ok", "name": coll.name}

    else:
        return {"error": f"Unknown action: {cmd}"}

def main():
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                req_id = req.get("req_id")
                res = handle_command(req)
                if req_id is not None:
                    res["req_id"] = req_id
                print(json.dumps(res), flush=True)
            except Exception as e:
                err_res = {
                    "error": str(e),
                    "trace": traceback.format_exc()
                }
                if 'req' in locals() and isinstance(req, dict) and "req_id" in req:
                    err_res["req_id"] = req["req_id"]
                print(json.dumps(err_res), flush=True)
    except (KeyboardInterrupt, BrokenPipeError, EOFError):
        pass
    finally:
        sys.exit(0)

if __name__ == "__main__":
    main()
