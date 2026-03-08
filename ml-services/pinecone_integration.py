"""
Pinecone Vector Database Integration for AetherGuard AI
Provides vector storage, similarity search, and RAG grounding validation
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
import numpy as np


@dataclass
class VectorDocument:
    """Document with vector embedding"""
    doc_id: str
    content: str
    embedding: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    namespace: str = "default"


@dataclass
class SearchResult:
    """Vector search result"""
    doc_id: str
    content: str
    score: float  # Similarity score (0-1)
    metadata: Dict[str, Any]
    
    def is_relevant(self, threshold: float = 0.85) -> bool:
        """Check if result is relevant based on threshold"""
        return self.score >= threshold


class PineconeClient:
    """
    Pinecone vector database client
    
    In production, use the official pinecone-client library:
    pip install pinecone-client
    
    This is a mock implementation for demonstration.
    """
    
    def __init__(
        self,
        api_key: str = None,
        environment: str = "us-west1-gcp",
        index_name: str = "aetherguard",
    ):
        self.api_key = api_key or "mock_api_key"
        self.environment = environment
        self.index_name = index_name
        self.dimension = 768  # Default embedding dimension
        
        # Mock storage (in production, this would be Pinecone cloud)
        self.vectors: Dict[str, VectorDocument] = {}
        self.namespaces: Dict[str, List[str]] = {"default": []}
        
        print(f"Initialized Pinecone client (mock)")
        print(f"  Environment: {environment}")
        print(f"  Index: {index_name}")
        print(f"  Dimension: {self.dimension}")
    
    def create_index(
        self,
        dimension: int = 768,
        metric: str = "cosine",
        pods: int = 1,
        pod_type: str = "p1.x1",
    ):
        """Create a new Pinecone index"""
        self.dimension = dimension
        print(f"Created index '{self.index_name}' with dimension {dimension}")
    
    def upsert(
        self,
        vectors: List[Tuple[str, List[float], Dict[str, Any]]],
        namespace: str = "default",
    ) -> int:
        """
        Upsert vectors to index
        
        Args:
            vectors: List of (id, embedding, metadata) tuples
            namespace: Namespace for organizing vectors
        
        Returns:
            Number of vectors upserted
        """
        if namespace not in self.namespaces:
            self.namespaces[namespace] = []
        
        for doc_id, embedding, metadata in vectors:
            # Validate embedding dimension
            if len(embedding) != self.dimension:
                raise ValueError(f"Embedding dimension mismatch: expected {self.dimension}, got {len(embedding)}")
            
            # Store vector
            doc = VectorDocument(
                doc_id=doc_id,
                content=metadata.get("content", ""),
                embedding=embedding,
                metadata=metadata,
                namespace=namespace,
            )
            
            self.vectors[f"{namespace}:{doc_id}"] = doc
            
            if doc_id not in self.namespaces[namespace]:
                self.namespaces[namespace].append(doc_id)
        
        return len(vectors)
    
    def query(
        self,
        vector: List[float],
        top_k: int = 5,
        namespace: str = "default",
        filter: Optional[Dict[str, Any]] = None,
        include_metadata: bool = True,
    ) -> List[SearchResult]:
        """
        Query similar vectors
        
        Args:
            vector: Query embedding
            top_k: Number of results to return
            namespace: Namespace to search in
            filter: Metadata filter
            include_metadata: Include metadata in results
        
        Returns:
            List of search results sorted by similarity
        """
        if namespace not in self.namespaces:
            return []
        
        # Calculate similarities
        results = []
        for doc_id in self.namespaces[namespace]:
            key = f"{namespace}:{doc_id}"
            doc = self.vectors.get(key)
            if not doc:
                continue
            
            # Apply metadata filter
            if filter:
                if not self._matches_filter(doc.metadata, filter):
                    continue
            
            # Calculate cosine similarity
            similarity = self._cosine_similarity(vector, doc.embedding)
            
            results.append(SearchResult(
                doc_id=doc.doc_id,
                content=doc.content,
                score=similarity,
                metadata=doc.metadata if include_metadata else {},
            ))
        
        # Sort by similarity and return top_k
        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]
    
    def fetch(
        self,
        ids: List[str],
        namespace: str = "default",
    ) -> Dict[str, VectorDocument]:
        """Fetch vectors by IDs"""
        results = {}
        for doc_id in ids:
            key = f"{namespace}:{doc_id}"
            doc = self.vectors.get(key)
            if doc:
                results[doc_id] = doc
        return results
    
    def delete(
        self,
        ids: List[str],
        namespace: str = "default",
    ) -> int:
        """Delete vectors by IDs"""
        deleted = 0
        for doc_id in ids:
            key = f"{namespace}:{doc_id}"
            if key in self.vectors:
                del self.vectors[key]
                if doc_id in self.namespaces.get(namespace, []):
                    self.namespaces[namespace].remove(doc_id)
                deleted += 1
        return deleted
    
    def describe_index_stats(self) -> Dict[str, Any]:
        """Get index statistics"""
        total_vectors = len(self.vectors)
        namespace_counts = {ns: len(ids) for ns, ids in self.namespaces.items()}
        
        return {
            "dimension": self.dimension,
            "index_fullness": 0.0,
            "total_vector_count": total_vectors,
            "namespaces": namespace_counts,
        }
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        # Convert to numpy arrays
        a = np.array(vec1)
        b = np.array(vec2)
        
        # Calculate cosine similarity
        dot_product = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        similarity = dot_product / (norm_a * norm_b)
        
        # Normalize to 0-1 range
        return (similarity + 1) / 2
    
    def _matches_filter(self, metadata: Dict[str, Any], filter: Dict[str, Any]) -> bool:
        """Check if metadata matches filter"""
        for key, value in filter.items():
            if key not in metadata:
                return False
            if metadata[key] != value:
                return False
        return True


class RAGGroundingValidator:
    """Validate RAG outputs against knowledge base using Pinecone"""
    
    def __init__(self, pinecone_client: PineconeClient):
        self.client = pinecone_client
        self.namespace = "knowledge_base"
    
    def index_knowledge_base(
        self,
        documents: List[Dict[str, Any]],
        embedding_model: Any = None,
    ) -> int:
        """
        Index knowledge base documents
        
        Args:
            documents: List of documents with 'content' and optional metadata
            embedding_model: Model to generate embeddings (if None, uses mock)
        
        Returns:
            Number of documents indexed
        """
        vectors = []
        
        for doc in documents:
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})
            
            # Generate document ID
            doc_id = hashlib.sha256(content.encode()).hexdigest()[:16]
            
            # Generate embedding
            if embedding_model:
                embedding = embedding_model.encode(content)
            else:
                # Mock embedding
                embedding = self._mock_embedding(content)
            
            # Add content to metadata
            metadata["content"] = content
            metadata["indexed_at"] = datetime.utcnow().isoformat()
            
            vectors.append((doc_id, embedding, metadata))
        
        # Upsert to Pinecone
        count = self.client.upsert(vectors, namespace=self.namespace)
        return count
    
    def validate_grounding(
        self,
        query: str,
        response: str,
        threshold: float = 0.85,
        embedding_model: Any = None,
    ) -> Dict[str, Any]:
        """
        Validate if response is grounded in knowledge base
        
        Args:
            query: User query
            response: Model response to validate
            threshold: Similarity threshold for grounding
            embedding_model: Model to generate embeddings
        
        Returns:
            Validation result with grounding status and evidence
        """
        # Generate embedding for response
        if embedding_model:
            response_embedding = embedding_model.encode(response)
        else:
            response_embedding = self._mock_embedding(response)
        
        # Search for similar documents
        results = self.client.query(
            vector=response_embedding,
            top_k=5,
            namespace=self.namespace,
        )
        
        # Check if any result meets threshold
        grounded = any(r.is_relevant(threshold) for r in results)
        
        # Get best match
        best_match = results[0] if results else None
        
        return {
            "grounded": grounded,
            "confidence": best_match.score if best_match else 0.0,
            "threshold": threshold,
            "evidence": [
                {
                    "content": r.content[:200] + "..." if len(r.content) > 200 else r.content,
                    "score": r.score,
                    "metadata": r.metadata,
                }
                for r in results[:3]
            ],
            "recommendation": "accept" if grounded else "reject",
        }
    
    def semantic_search(
        self,
        query: str,
        top_k: int = 5,
        embedding_model: Any = None,
    ) -> List[SearchResult]:
        """
        Perform semantic search on knowledge base
        
        Args:
            query: Search query
            top_k: Number of results
            embedding_model: Model to generate embeddings
        
        Returns:
            List of search results
        """
        # Generate query embedding
        if embedding_model:
            query_embedding = embedding_model.encode(query)
        else:
            query_embedding = self._mock_embedding(query)
        
        # Search
        results = self.client.query(
            vector=query_embedding,
            top_k=top_k,
            namespace=self.namespace,
        )
        
        return results
    
    def _mock_embedding(self, text: str) -> List[float]:
        """Generate mock embedding for demonstration"""
        # In production, use actual embedding model (e.g., sentence-transformers)
        # This creates a deterministic "embedding" based on text hash
        
        hash_bytes = hashlib.sha256(text.encode()).digest()
        
        # Convert to floats in range [-1, 1]
        embedding = []
        for i in range(0, len(hash_bytes) * 8, 8):
            byte_idx = i // 8
            if byte_idx < len(hash_bytes):
                value = (hash_bytes[byte_idx] / 255.0) * 2 - 1
                embedding.append(value)
        
        # Pad or truncate to dimension
        while len(embedding) < self.client.dimension:
            embedding.append(0.0)
        
        return embedding[:self.client.dimension]


class SemanticCache:
    """Semantic caching using Pinecone for faster responses"""
    
    def __init__(self, pinecone_client: PineconeClient):
        self.client = pinecone_client
        self.namespace = "semantic_cache"
        self.cache_threshold = 0.95  # High threshold for cache hits
    
    def get(
        self,
        query: str,
        embedding_model: Any = None,
    ) -> Optional[str]:
        """
        Get cached response for semantically similar query
        
        Args:
            query: User query
            embedding_model: Model to generate embeddings
        
        Returns:
            Cached response if found, None otherwise
        """
        # Generate query embedding
        if embedding_model:
            query_embedding = embedding_model.encode(query)
        else:
            query_embedding = self._mock_embedding(query)
        
        # Search for similar cached queries
        results = self.client.query(
            vector=query_embedding,
            top_k=1,
            namespace=self.namespace,
        )
        
        # Check if result meets cache threshold
        if results and results[0].score >= self.cache_threshold:
            return results[0].metadata.get("response")
        
        return None
    
    def set(
        self,
        query: str,
        response: str,
        embedding_model: Any = None,
        ttl_hours: int = 24,
    ):
        """
        Cache query-response pair
        
        Args:
            query: User query
            response: Model response
            embedding_model: Model to generate embeddings
            ttl_hours: Time to live in hours
        """
        # Generate query embedding
        if embedding_model:
            query_embedding = embedding_model.encode(query)
        else:
            query_embedding = self._mock_embedding(query)
        
        # Generate cache ID
        cache_id = hashlib.sha256(query.encode()).hexdigest()[:16]
        
        # Store in Pinecone
        metadata = {
            "query": query,
            "response": response,
            "cached_at": datetime.utcnow().isoformat(),
            "ttl_hours": ttl_hours,
        }
        
        self.client.upsert(
            vectors=[(cache_id, query_embedding, metadata)],
            namespace=self.namespace,
        )
    
    def _mock_embedding(self, text: str) -> List[float]:
        """Generate mock embedding"""
        validator = RAGGroundingValidator(self.client)
        return validator._mock_embedding(text)


# Global instances
_pinecone_client = None
_rag_validator = None
_semantic_cache = None


def get_pinecone_client(
    api_key: str = None,
    environment: str = "us-west1-gcp",
    index_name: str = "aetherguard",
) -> PineconeClient:
    """Get or create global Pinecone client instance"""
    global _pinecone_client
    if _pinecone_client is None:
        _pinecone_client = PineconeClient(api_key, environment, index_name)
    return _pinecone_client


def get_rag_validator() -> RAGGroundingValidator:
    """Get or create global RAG validator instance"""
    global _rag_validator
    if _rag_validator is None:
        client = get_pinecone_client()
        _rag_validator = RAGGroundingValidator(client)
    return _rag_validator


def get_semantic_cache() -> SemanticCache:
    """Get or create global semantic cache instance"""
    global _semantic_cache
    if _semantic_cache is None:
        client = get_pinecone_client()
        _semantic_cache = SemanticCache(client)
    return _semantic_cache


# Example usage
if __name__ == "__main__":
    # Initialize Pinecone
    client = get_pinecone_client()
    client.create_index(dimension=768)
    
    # Index knowledge base
    validator = get_rag_validator()
    
    knowledge_docs = [
        {
            "content": "AetherGuard AI is an AI firewall that protects against prompt injection, toxicity, and PII exposure.",
            "metadata": {"source": "documentation", "category": "overview"},
        },
        {
            "content": "The system uses Llama Guard for injection detection with >90% accuracy.",
            "metadata": {"source": "documentation", "category": "models"},
        },
        {
            "content": "GDPR compliance is ensured through PII detection and redaction using Microsoft Presidio.",
            "metadata": {"source": "documentation", "category": "compliance"},
        },
    ]
    
    indexed = validator.index_knowledge_base(knowledge_docs)
    print(f"Indexed {indexed} documents")
    
    # Validate grounding
    query = "What is AetherGuard?"
    response = "AetherGuard AI is a comprehensive AI firewall system."
    
    result = validator.validate_grounding(query, response, threshold=0.85)
    print(f"\nGrounding validation:")
    print(f"  Grounded: {result['grounded']}")
    print(f"  Confidence: {result['confidence']:.2f}")
    print(f"  Recommendation: {result['recommendation']}")
    
    # Semantic search
    search_results = validator.semantic_search("How does injection detection work?", top_k=3)
    print(f"\nSemantic search results:")
    for i, result in enumerate(search_results, 1):
        print(f"  {i}. Score: {result.score:.2f} - {result.content[:100]}...")
    
    # Semantic cache
    cache = get_semantic_cache()
    
    # Cache miss
    cached = cache.get("What is AetherGuard?")
    print(f"\nCache lookup: {'HIT' if cached else 'MISS'}")
    
    # Set cache
    cache.set("What is AetherGuard?", "AetherGuard AI is an AI firewall system.")
    
    # Cache hit
    cached = cache.get("What is AetherGuard?")
    print(f"Cache lookup after set: {'HIT' if cached else 'MISS'}")
    if cached:
        print(f"Cached response: {cached}")
    
    # Index stats
    stats = client.describe_index_stats()
    print(f"\nIndex statistics:")
    print(f"  Total vectors: {stats['total_vector_count']}")
    print(f"  Namespaces: {stats['namespaces']}")
