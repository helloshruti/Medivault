import os
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import ollama

# ---------------- CONFIG ----------------
DOC_PATH = DOC_PATH = "/Volumes/Rahul's SSD/SHRUTI - WIN2MAC/WIN TO MAC/medivault data/MediVault Medical information.pdf"
INDEX_PATH = "vector.index"
EMBED_MODEL = "all-MiniLM-L6-v2"
LLM_MODEL = "mistral"
TOP_K = 3
# ---------------------------------------


def load_documents():
    with open(DOC_PATH, "r", encoding="utf-8") as f:
        return f.readlines()


def create_or_load_index(documents, embedder):
    if os.path.exists(INDEX_PATH):
        return faiss.read_index(INDEX_PATH)

    print("Creating FAISS index...")
    embeddings = embedder.encode(documents, convert_to_numpy=True)

    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)
    faiss.write_index(index, INDEX_PATH)

    return index


def retrieve_context(query, index, documents, embedder):
    query_vec = embedder.encode([query])
    distances, indices = index.search(np.array(query_vec), TOP_K)
    return "\n".join([documents[i] for i in indices[0]])


def generate_answer(query, context):
    prompt = f"""
You are an intelligent assistant.
Use ONLY the context below to answer.

Context:
{context}

Question:
{query}

Answer:
"""
    response = ollama.chat(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )

    return response["message"]["content"]


def main():
    print("\n🔹 Local RAG Chatbot (No API Key)")
    print("Type 'exit' to quit\n")

    embedder = SentenceTransformer(EMBED_MODEL)
    documents = load_documents()
    index = create_or_load_index(documents, embedder)

    while True:
        query = input("You: ")
        if query.lower() == "exit":
            break

        context = retrieve_context(query, index, documents, embedder)
        answer = generate_answer(query, context)

        print("\nBot:", answer, "\n")


if __name__ == "__main__":
    main()
