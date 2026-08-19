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
        query_text = cmd_data.get("query_text", "")
        repository_id = cmd_data.get("repository_id")
        repository_ids = cmd_data.get("repository_ids")
        include_docs = cmd_data.get("include_docs", False)
        limit = int(cmd_data.get("limit", 8))
        file_path = cmd_data.get("file_path")

        repo_ids = []
        if isinstance(repository_ids, list) and len(repository_ids) > 0:
            repo_ids = [str(r).strip() for r in repository_ids if str(r).strip()]
        elif repository_id:
            repo_ids = [str(repository_id).strip()]

        has_vector = isinstance(raw_vector, list) and len(raw_vector) > 0
        has_text = isinstance(query_text, str) and bool(query_text.strip())

        if not has_vector and not has_text and not include_docs:
            return {"results": []}

        coll = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        total_count = coll.count()
        if total_count == 0:
            return {"results": []}

        # Build where clause
        if not repo_ids:
            where_clause = {}
        elif len(repo_ids) == 1:
            where_clause = {"repositoryId": repo_ids[0]}
        else:
            where_clause = {"repositoryId": {"$in": repo_ids}}

        if file_path:
            if where_clause:
                where_clause = {
                    "$and": [
                        where_clause,
                        {"filePath": file_path}
                    ]
                }
            else:
                where_clause = {"filePath": file_path}

        candidate_map = {}

        # 1. Dense Vector Search if vector is present
        if has_vector:
            query_vector = [float(x) for x in raw_vector]
            n_results = min(max(limit * 4, 30), total_count)
            try:
                query_res = coll.query(
                    query_embeddings=[query_vector],
                    n_results=n_results,
                    where=where_clause if where_clause else None,
                    include=["metadatas", "documents", "distances"]
                )
                ids_list = query_res.get("ids", [[]])[0] if query_res.get("ids") else []
                distances = query_res.get("distances", [[]])[0] if query_res.get("distances") else []
                metadatas = query_res.get("metadatas", [[]])[0] if query_res.get("metadatas") else []
                documents = query_res.get("documents", [[]])[0] if query_res.get("documents") else []

                for i in range(len(ids_list)):
                    dist = distances[i] if i < len(distances) else 0.0
                    meta = metadatas[i] if i < len(metadatas) else {}
                    doc = documents[i] if i < len(documents) else ""
                    # Cosine distance to similarity: 1 - (dist / 2)
                    sim_score = max(0.0, min(1.0, 1.0 - (dist / 2.0)))

                    payload = dict(meta) if meta else {}
                    payload["content"] = doc

                    cid = str(ids_list[i])
                    candidate_map[cid] = {
                        "id": cid,
                        "vector_score": float(sim_score),
                        "payload": payload
                    }
            except Exception as e:
                pass

        # 2. Exact Keyword & Substring Search across Documents in ChromaDB
        if has_text:
            cleaned_query = query_text.strip()
            terms_to_try = [cleaned_query]
            words = [w.strip() for w in cleaned_query.replace("-", " ").replace("_", " ").split() if len(w.strip()) >= 2]
            for w in words[:6]:
                if w not in terms_to_try:
                    terms_to_try.append(w)

            for term in terms_to_try:
                try:
                    kw_res = coll.get(
                        where=where_clause if where_clause else None,
                        where_document={"$contains": term},
                        limit=limit * 3,
                        include=["metadatas", "documents"]
                    )
                    kw_ids = kw_res.get("ids", [])
                    kw_docs = kw_res.get("documents", [])
                    kw_metas = kw_res.get("metadatas", [])

                    for ki in range(len(kw_ids)):
                        cid = str(kw_ids[ki])
                        if cid not in candidate_map:
                            meta = kw_metas[ki] if (kw_metas and ki < len(kw_metas)) else {}
                            doc = kw_docs[ki] if (kw_docs and ki < len(kw_docs)) else ""
                            payload = dict(meta) if meta else {}
                            payload["content"] = doc
                            candidate_map[cid] = {
                                "id": cid,
                                "vector_score": 0.50,
                                "payload": payload
                            }
                except Exception:
                    pass

        # 3. Always include project documentation (README, package.json, docs) for overview/motivation queries
        if include_docs or (has_text and any(k in query_text.lower() for k in ["brief", "overview", "motivation", "about", "what is", "purpose", "explain project", "explain repo"])):
            try:
                doc_res = coll.get(
                    where=where_clause if where_clause else None,
                    limit=30,
                    include=["metadatas", "documents"]
                )
                doc_ids = doc_res.get("ids", [])
                doc_metas = doc_res.get("metadatas", [])
                doc_docs = doc_res.get("documents", [])

                for di in range(len(doc_ids)):
                    dmeta = doc_metas[di] if (doc_metas and di < len(doc_metas)) else {}
                    fpath = str(dmeta.get("filePath", "")).lower()
                    if "readme" in fpath or "package.json" in fpath or fpath.startswith("docs/") or "architecture" in fpath:
                        cid = str(doc_ids[di])
                        if cid not in candidate_map:
                            dpayload = dict(dmeta) if dmeta else {}
                            dpayload["content"] = doc_docs[di] if (doc_docs and di < len(doc_docs)) else ""
                            candidate_map[cid] = {
                                "id": cid,
                                "vector_score": 0.75 if "readme" in fpath else 0.65,
                                "payload": dpayload
                            }
            except Exception:
                pass

        # 4. Hybrid Re-scoring: exact keyword occurrence, token frequency, and symbol matches
        results = []
        lower_query = query_text.lower().strip() if has_text else ""
        query_tokens = [t for t in lower_query.split() if len(t) >= 2] if lower_query else []

        for cid, item in candidate_map.items():
            base_score = item["vector_score"]
            payload = item["payload"]
            content = payload.get("content", "")
            lower_content = content.lower()
            lower_file = str(payload.get("filePath", "")).lower()
            name = str(payload.get("name", "")).lower()

            keyword_boost = 0.0

            # Boost README and documentation files for broad queries
            if "readme" in lower_file:
                keyword_boost += 0.20
            elif "package.json" in lower_file or lower_file.startswith("docs/"):
                keyword_boost += 0.10

            if lower_query:
                # Exact phrase match in content
                if lower_query in lower_content:
                    keyword_boost += 0.35
                    base_score = max(base_score, 0.85)

                # Exact phrase match in file path
                if lower_query in lower_file:
                    keyword_boost += 0.40
                    base_score = max(base_score, 0.90)

                # Symbol / function name match
                if name and lower_query in name:
                    keyword_boost += 0.30
                    base_score = max(base_score, 0.88)

                # Token occurrences
                matched_tokens = 0
                for token in query_tokens:
                    if token in lower_content:
                        matched_tokens += 1
                        keyword_boost += 0.06
                    if token in lower_file:
                        matched_tokens += 1
                        keyword_boost += 0.10

                if query_tokens and matched_tokens == len(query_tokens):
                    keyword_boost += 0.15

            final_score = min(1.0, base_score + keyword_boost)
            results.append({
                "id": cid,
                "score": float(round(final_score, 4)),
                "payload": payload
            })

        # Sort descending by final score
        results.sort(key=lambda x: x["score"], reverse=True)
        return {"results": results[:limit]}

    elif cmd == "count":
        repository_id = cmd_data.get("repository_id")
        repository_ids = cmd_data.get("repository_ids")
        coll = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        repo_ids = []
        if isinstance(repository_ids, list) and len(repository_ids) > 0:
            repo_ids = [str(r).strip() for r in repository_ids if str(r).strip()]
        elif repository_id:
            repo_ids = [str(repository_id).strip()]

        if not repo_ids:
            return {"count": coll.count()}
        elif len(repo_ids) == 1:
            res = coll.get(where={"repositoryId": repo_ids[0]})
            return {"count": len(res.get("ids", []))}
        else:
            res = coll.get(where={"repositoryId": {"$in": repo_ids}})
            return {"count": len(res.get("ids", []))}

    elif cmd == "get_docs":
        repository_id = cmd_data.get("repository_id")
        repository_ids = cmd_data.get("repository_ids")
        limit = int(cmd_data.get("limit", 10))

        coll = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        repo_ids = []
        if isinstance(repository_ids, list) and len(repository_ids) > 0:
            repo_ids = [str(r).strip() for r in repository_ids if str(r).strip()]
        elif repository_id:
            repo_ids = [str(repository_id).strip()]

        if not repo_ids:
            where_clause = {}
        elif len(repo_ids) == 1:
            where_clause = {"repositoryId": repo_ids[0]}
        else:
            where_clause = {"repositoryId": {"$in": repo_ids}}

        try:
            res = coll.get(where=where_clause if where_clause else None, limit=100, include=["metadatas", "documents"])
            ids_list = res.get("ids", [])
            metas = res.get("metadatas", [])
            docs = res.get("documents", [])

            doc_results = []
            for i in range(len(ids_list)):
                meta = metas[i] if (metas and i < len(metas)) else {}
                fpath = str(meta.get("filePath", "")).lower()
                if "readme" in fpath or "package.json" in fpath or fpath.startswith("docs/") or "architecture" in fpath:
                    payload = dict(meta) if meta else {}
                    payload["content"] = docs[i] if (docs and i < len(docs)) else ""
                    doc_results.append({
                        "id": ids_list[i],
                        "score": 0.95 if "readme" in fpath else 0.85,
                        "payload": payload
                    })

            return {"results": doc_results[:limit]}
        except Exception as e:
            return {"results": [], "error": str(e)}

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
