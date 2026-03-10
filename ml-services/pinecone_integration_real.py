"""
Real Pinecone Vector Database Integration
Replaces mock implementation with actual Pinecone client
"""

import logging
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import hashlib
import json

logger = logging.getLogger(__name__)

@dataclass
class VectorDocument:
    """Document with vector embedding"""
    id: str
    content: str
    embedding: List[float]
    metadata: Dict[str, Any]
    
    def to_pinecone_vector(self) -> Dict[str, Any]:
        """Convert to Pinecone vector format"""
        return {
            "id": self.id,
            "values": self.embedding,
            "metadata": {
                **self.metadata,
                "content": self.content[:1000]  # Truncate content for metadata
            }
        }

@dataclass
class SearchResult:
    """Vector search result"""
    id: str
    score: float
    content: str
    metadata: Dict[str, Any]
    
    def is_relevant(self, threshold: float = 0.85) -> bool:
        """Check if result meets relevance threshold"""
        return self.score >= threshold

class PineconeClient:
    """Real Pinecone vector database client"""
    
    def __init__(
        self,
        api_key: str = None,
        environment: str = None,
        index_name: str = "aetherguard-vectors",
        dimension: int = 768
    ):
        self.api_key = api_key or os.getenv("PINECONE_API_KEY")
        self.environment = environment or os.getenv("PINECONE_ENVIRONMENT", "us-west1-gcp")
        self.index_name = index_name
        self.dimension = dimension
        self.index = None
        self.embedding_model = None
        self.is_fallback = False
        
        try:
            import pinecone
            from sentence_transformers import SentenceTransformer
            
            if not self.api_key:
                raise ValueError("Pinecone API key not provided")
            
            # Initialize Pinecone
            pinecone.init(api_key=self.api_key, environment=self.environment)
            
            # Create index if it doesn't exist
            if self.index_name not in pinecone.list_indexes():
                logger.info(f"Creating Pinecone index: {self.index_name}")
                pinecone.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric='cosine',
                    metadata_config={
                        "indexed": ["content_type", "tenant_id", "timestamp"]
                    }
                )
            
            self.index = pinecone.Index(self.index_name)
            
            # Initialize embedding model
            self.embedding_model = SentenceTransformer('all-mpnet-base-v2')
            
            logger.info(f"PineconeClient initialized with index {self.index_name}")
            
        except ImportError:
            logger.warning("Pinecone or sentence-transformers not installed, using fallback mode")
            self.is_fallback = True
            self._init_fallback()
        except Exception as e:
            logger.error(f"Failed to initialize Pinecone: {e}, using fallback mode")
            self.is_fallback = True
            self._init_fallback()
    
    def _init_fallback(self):
        """Initialize fallback in-memory storage"""
        self.fallback_storage = {}
        logger.info("PineconeClient initialized in fallback mode (in-memory)")
    
    def create_index(self, dimension: int = 768, metric: str = "cosine") -> bool:
        """Create a new index (if using real Pinecone)"""
        if self.is_fallback:
            logger.info("Fallback mode: Index creation simulated")
            return True
        
        try:
            import pinecone
            
            if self.index_name in pinecone.list_indexes():
                logger.info(f"Index {self.index_name} already exists")
                return True
            
            pinecone.create_index(
                name=self.index_name,
                dimension=dimension,
                metric=metric
            )
            
            self.index = pinecone.Index(self.index_name)
            logger.info(f"Created Pinecone index: {self.index_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create index: {e}")
            return False
    
    def upsert(
        self,
        documents: List[VectorDocument],
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """Upsert documents to vector database"""
        if self.is_fallback:
            return self._upsert_fallback(documents)
        
        try:
            vectors = [doc.to_pinecone_vector() for doc in documents]
            
            # Batch upsert for better performance
            upserted_count = 0
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                response = self.index.upsert(vectors=batch)
                upserted_count += response.get('upserted_count', len(batch))
            
            logger.info(f"Upserted {upserted_count} vectors to Pinecone")
            
            return {
                "upserted_count": upserted_count,
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"Failed to upsert vectors: {e}")
            return {"status": "error", "error": str(e)}
    
    def _upsert_fallback(self, documents: List[VectorDocument]) -> Dict[str, Any]:
        """Fallback upsert to in-memory storage"""
        for doc in documents:
            self.fallback_storage[doc.id] = {
                "content": doc.content,
                "embedding": doc.embedding,
                "metadata": doc.metadata
            }
        
        logger.info(f"Fallback: Stored {len(documents)} documents in memory")
        return {"upserted_count": len(documents), "status": "success"}
    
    def query(
        self,
        text: str = None,
        vector: List[float] = None,
        top_k: int = 5,
        filter: Dict[str, Any] = None,
        include_metadata: bool = True
    ) -> List[SearchResult]:
        """Query vector database"""
        if self.is_fallback:
            return self._query_fallback(text, vector, top_k, filter)
        
        try:
            # Generate embedding if text provided
            if text and not vector:
                vector = self.embedding_model.encode(text).tolist()
            
            if not vector:
                raise ValueError("Either text or vector must be provided")
            
            # Query Pinecone
            response = self.index.query(
                vector=vector,
                top_k=top_k,
                filter=filter,
                include_metadata=include_metadata
            )
            
            # Convert to SearchResult objects
            results = []
            for match in response.matches:
                results.append(SearchResult(
                    id=match.id,
                    score=match.score,
                    content=match.metadata.get("content", ""),
                    metadata=match.metadata
                ))
            
            logger.info(f"Found {len(results)} results for query")
            return results
            
        except Exception as e:
            logger.error(f"Failed to query vectors: {e}")
            return []
    
    def _query_fallback(
        self,
        text: str = None,
        vector: List[float] = None,
        top_k: int = 5,
        filter: Dict[str, Any] = None
    ) -> List[SearchResult]:
        """Fallback query using in-memory storage"""
        if not text:
            return []
        
        # Simple text similarity (mock)
        results = []
        for doc_id, doc_data in self.fallback_storage.items():
            # Simple keyword matching for fallback
            content = doc_data["content"].lower()
            query_words = text.lower().split()
            
            # Calculate simple similarity score
            matches = sum(1 for word in query_words if word in content)
            score = matches / len(query_words) if query_words else 0
            
            if score > 0:
                results.append(SearchResult(
                    id=doc_id,
                    score=score,
                    content=doc_data["content"],
                    metadata=doc_data["metadata"]
                ))
        
        # Sort by score and return top_k
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]
    
    def fetch(self, ids: List[str]) -> Dict[str, VectorDocument]:
        """Fetch documents by IDs"""
        if self.is_fallback:
            return self._fetch_fallback(ids)
        
        try:
            response = self.index.fetch(ids=ids)
            
            documents = {}
            for doc_id, vector_data in response.vectors.items():
                documents[doc_id] = VectorDocument(
                    id=doc_id,
                    content=vector_data.metadata.get("content", ""),
                    embedding=vector_data.values,
                    metadata=vector_data.metadata
                )
            
            return documents
            
        except Exception as e:
            logger.error(f"Failed to fetch vectors: {e}")
            return {}
    
    def _fetch_fallback(self, ids: List[str]) -> Dict[str, VectorDocument]:
        """Fallback fetch from in-memory storage"""
        documents = {}
        for doc_id in ids:
            if doc_id in self.fallback_storage:
                doc_data = self.fallback_storage[doc_id]
                documents[doc_id] = VectorDocument(
                    id=doc_id,
                    content=doc_data["content"],
                    embedding=doc_data["embedding"],
                    metadata=doc_data["metadata"]
                )
        
        return documents
    
    def delete(self, ids: List[str]) -> Dict[str, Any]:
        """Delete documents by IDs"""
        if self.is_fallback:
            return self._delete_fallback(ids)
        
        try:
            response = self.index.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} vectors from Pinecone")
            return {"deleted_count": len(ids), "status": "success"}
            
        except Exception as e:
            logger.error(f"Failed to delete vectors: {e}")
            return {"status": "error", "error": str(e)}
    
    def _delete_fallback(self, ids: List[str]) -> Dict[str, Any]:
        """Fallback delete from in-memory storage"""
        deleted_count = 0
        for doc_id in ids:
            if doc_id in self.fallback_storage:
                del self.fallback_storage[doc_id]
                deleted_count += 1
        
        logger.info(f"Fallback: Deleted {deleted_count} documents from memory")
        return {"deleted_count": deleted_count, "status": "success"}
    
    def describe_index_stats(self) -> Dict[str, Any]:
        """Get index statistics"""
        if self.is_fallback:
            return {
                "dimension": self.dimension,
                "index_fullness": 0.0,
                "total_vector_count": len(self.fallback_storage),
                "mode": "fallback"
            }
        
        try:
            stats = self.index.describe_index_stats()
            return {
                "dimension": stats.dimension,
                "index_fullness": stats.index_fullness,
                "total_vector_count": stats.total_vector_count,
                "mode": "pinecone"
            }
            
        except Exception as e:
            logger.error(f"Failed to get index stats: {e}")
            return {"error": str(e)}

class RAGGroundingValidator:
    """RAG grounding validation using real Pinecone"""
    
    def __init__(self, pinecone_client: PineconeClient):
        self.pinecone_client = pinecone_client
        self.knowledge_base_indexed = False
    
    def index_knowledge_base(
        self,
        documents: List[Dict[str, Any]],
        content_field: str = "content",
        metadata_fields: List[str] = None
    ) -> Dict[str, Any]:
        """Index knowledge base documents"""
        try:
            vector_docs = []
            
            for i, doc in enumerate(documents):
                content = doc.get(content_field, "")
                if not content:
                    continue
                
                # Generate embedding
                if self.pinecone_client.embedding_model:
                    embedding = self.pinecone_client.embedding_model.encode(content).tolist()
                else:
                    # Fallback: mock embedding
                    embedding = [0.1] * self.pinecone_client.dimension
                
                # Prepare metadata
                metadata = {"content_type": "knowledge_base"}
                if metadata_fields:
                    for field in metadata_fields:
                        if field in doc:
                            metadata[field] = doc[field]
                
                vector_docs.append(VectorDocument(
                    id=f"kb_{i}_{hashlib.md5(content.encode()).hexdigest()[:8]}",
                    content=content,
                    embedding=embedding,
                    metadata=metadata
                ))
            
            # Upsert to Pinecone
            result = self.pinecone_client.upsert(vector_docs)
            
            if result.get("status") == "success":
                self.knowledge_base_indexed = True
                logger.info(f"Indexed {len(vector_docs)} knowledge base documents")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to index knowledge base: {e}")
            return {"status": "error", "error": str(e)}
    
    def validate_grounding(
        self,
        output: str,
        context_docs: List[str] = None,
        similarity_threshold: float = 0.85
    ) -> Dict[str, Any]:
        """Validate if output is grounded in knowledge base"""
        try:
            # Search for similar content in knowledge base
            search_results = self.pinecone_client.query(
                text=output,
                top_k=5,
                filter={"content_type": "knowledge_base"}
            )
            
            if not search_results:
                return {
                    "grounded": False,
                    "similarity": 0.0,
                    "sources": [],
                    "method": "rag_grounding"
                }
            
            # Get best similarity score
            best_score = max(result.score for result in search_results)
            
            # Check if grounded
            is_grounded = best_score >= similarity_threshold
            
            # Prepare source information
            sources = [
                {
                    "content": result.content[:200] + "..." if len(result.content) > 200 else result.content,
                    "score": result.score,
                    "metadata": result.metadata
                }
                for result in search_results[:3]  # Top 3 sources
            ]
            
            return {
                "grounded": is_grounded,
                "similarity": best_score,
                "sources": sources,
                "method": "rag_grounding",
                "threshold": similarity_threshold
            }
            
        except Exception as e:
            logger.error(f"Failed to validate grounding: {e}")
            return {
                "grounded": False,
                "similarity": 0.0,
                "sources": [],
                "error": str(e)
            }
    
    def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        filter: Dict[str, Any] = None
    ) -> List[SearchResult]:
        """Perform semantic search in knowledge base"""
        search_filter = {"content_type": "knowledge_base"}
        if filter:
            search_filter.update(filter)
        
        return self.pinecone_client.query(
            text=query,
            top_k=top_k,
            filter=search_filter
        )

class SemanticCache:
    """Semantic caching using real Pinecone"""
    
    def __init__(self, pinecone_client: PineconeClient):
        self.pinecone_client = pinecone_client
        self.cache_ttl = 3600  # 1 hour default TTL
    
    def get(
        self,
        query: str,
        similarity_threshold: float = 0.95
    ) -> Optional[Dict[str, Any]]:
        """Get cached response for similar query"""
        try:
            # Search for similar cached queries
            results = self.pinecone_client.query(
                text=query,
                top_k=1,
                filter={"content_type": "cache"}
            )
            
            if results and results[0].score >= similarity_threshold:
                cached_data = results[0].metadata
                
                # Check TTL
                import time
                if time.time() - cached_data.get("timestamp", 0) < self.cache_ttl:
                    logger.info(f"Cache hit for query (similarity: {results[0].score:.3f})")
                    return {
                        "response": cached_data.get("response"),
                        "metadata": cached_data.get("response_metadata", {}),
                        "cached_at": cached_data.get("timestamp"),
                        "similarity": results[0].score
                    }
                else:
                    # Cache expired, delete it
                    self.pinecone_client.delete([results[0].id])
                    logger.info("Cache entry expired and removed")
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get from cache: {e}")
            return None
    
    def set(
        self,
        query: str,
        response: str,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """Cache query-response pair"""
        try:
            import time
            
            # Generate embedding for query
            if self.pinecone_client.embedding_model:
                embedding = self.pinecone_client.embedding_model.encode(query).tolist()
            else:
                # Fallback: mock embedding
                embedding = [0.1] * self.pinecone_client.dimension
            
            # Create cache document
            cache_id = f"cache_{hashlib.md5(query.encode()).hexdigest()}"
            
            cache_doc = VectorDocument(
                id=cache_id,
                content=query,
                embedding=embedding,
                metadata={
                    "content_type": "cache",
                    "response": response,
                    "response_metadata": metadata or {},
                    "timestamp": time.time()
                }
            )
            
            # Store in Pinecone
            result = self.pinecone_client.upsert([cache_doc])
            
            if result.get("status") == "success":
                logger.info("Cached query-response pair")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to set cache: {e}")
            return False

# Global instances
_pinecone_client = None
_rag_validator = None
_semantic_cache = None

def get_pinecone_client(
    api_key: str = None,
    environment: str = None,
    index_name: str = "aetherguard-vectors"
) -> PineconeClient:
    """Get global Pinecone client instance"""
    global _pinecone_client
    
    if _pinecone_client is None:
        _pinecone_client = PineconeClient(
            api_key=api_key,
            environment=environment,
            index_name=index_name
        )
    
    return _pinecone_client

def get_rag_validator() -> RAGGroundingValidator:
    """Get global RAG validator instance"""
    global _rag_validator
    
    if _rag_validator is None:
        client = get_pinecone_client()
        _rag_validator = RAGGroundingValidator(client)
    
    return _rag_validator

def get_semantic_cache() -> SemanticCache:
    """Get global semantic cache instance"""
    global _semantic_cache
    
    if _semantic_cache is None:
        client = get_pinecone_client()
        _semantic_cache = SemanticCache(client)
    
    return _semantic_cache