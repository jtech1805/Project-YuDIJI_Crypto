# MongoDB Atlas vector-search selection report

Status: `LIVE_ATLAS_VECTOR_VALIDATION_NOT_RUN`

- Provider: MongoDB Atlas Vector Search
- Logical index: `YUDIJI_ATLAS_PLATFORM_KNOWLEDGE_GEMINI_768` v1
- Atlas index name: `yudiji_atlas_platform_knowledge_gemini_768_v1`
- Collection: `knowledgevectorindexprojections`
- Vector: `vector`, 768 dimensions, cosine
- ANN: implemented with explicit bounded `limit` and `numCandidates`
- ENN: implemented as validation-only `exact: true`, without `numCandidates`
- Authority: immutable projection collection; no third vector copy
- Production registration: absent
- Publication manifest: absent

No Atlas credentials or development deployment were used during implementation. Live index status, Atlas tier/version, query latency, ANN quality, ENN availability, and live filter behavior remain unverified.
