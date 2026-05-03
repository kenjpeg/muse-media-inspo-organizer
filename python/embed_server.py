"""
CLIP embedding server for Design Organizer.
Communicates via JSON-lines over stdin/stdout.

Protocol:
  Request:  {"id": "1", "method": "embed_image", "params": {"path": "/path/to/image.jpg"}}
  Response: {"id": "1", "embedding": [0.1, 0.2, ...]}

  Request:  {"id": "2", "method": "embed_text", "params": {"text": "sunset architecture"}}
  Response: {"id": "2", "embedding": [0.1, 0.2, ...]}
"""

import sys
import json
import torch
import open_clip
from PIL import Image

model = None
preprocess = None
tokenizer = None
device = "mps" if torch.backends.mps.is_available() else "cpu"


def load_model():
    global model, preprocess, tokenizer
    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="laion2b_s34b_b79k"
    )
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    model = model.to(device)
    model.eval()
    sys.stderr.write("CLIP model loaded\n")
    sys.stderr.flush()


def embed_image(path: str) -> list:
    image = preprocess(Image.open(path).convert("RGB")).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(image)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding[0].cpu().numpy().tolist()


def embed_text(text: str) -> list:
    tokens = tokenizer([text]).to(device)
    with torch.no_grad():
        embedding = model.encode_text(tokens)
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)
    return embedding[0].cpu().numpy().tolist()


def main():
    load_model()
    # Signal ready
    print(json.dumps({"id": "ready", "status": "ok"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            req_id = request.get("id", "0")
            method = request.get("method", "")
            params = request.get("params", {})

            if method == "embed_image":
                embedding = embed_image(params["path"])
                response = {"id": req_id, "embedding": embedding}
            elif method == "embed_text":
                embedding = embed_text(params["text"])
                response = {"id": req_id, "embedding": embedding}
            elif method == "ping":
                response = {"id": req_id, "status": "ok"}
            else:
                response = {"id": req_id, "error": f"Unknown method: {method}"}

            print(json.dumps(response), flush=True)

        except Exception as e:
            error_response = {"id": request.get("id", "0") if "request" in dir() else "0", "error": str(e)}
            print(json.dumps(error_response), flush=True)


if __name__ == "__main__":
    main()
