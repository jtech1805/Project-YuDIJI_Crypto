# MongoDB Atlas vector-search development runbook

This runbook is development-only. It does not publish an index for production use.

1. Use a dedicated Atlas development database containing only synthetic `PLATFORM_KNOWLEDGE` projections created through `KnowledgeVectorIndexingService` and the immutable projection write authority.
2. Set `MONGO_URI`, `YUDIJI_ATLAS_VECTOR_DATABASE`, `YUDIJI_ATLAS_VECTOR_COLLECTION=knowledgevectorindexprojections`, and `YUDIJI_ATLAS_VECTOR_INDEX_NAME=yudiji_atlas_platform_knowledge_gemini_768_v1`.
3. Inspect/create once with both `YUDIJI_ATLAS_VECTOR_INDEX_CREATION_CONFIRMED=true` and `YUDIJI_ATLAS_VECTOR_LIVE_VALIDATION_CONFIRMED=true`, then run `npm run atlas:create-vector-index`.
4. Supply a bounded JSON array of exact document identities in `YUDIJI_ATLAS_VECTOR_BENCHMARK_ELIGIBLE_DOCUMENTS` and choose `ATLAS_ONLY_DETERMINISTIC_VECTOR_FIXTURES` or the separately approved Gemini mode.
5. Run `npm run benchmark:atlas-vector-search`. Use `YUDIJI_ATLAS_VECTOR_BENCHMARK_SEARCH_MODE=ENN` only for explicit capability validation.

Never use production databases, private/market content, raw text, automatic embeddings, startup index creation, index replacement, or index deletion. A queryable index is not a publication approval.
