from mcp.server.fastmcp import FastMCP
import requests

mcp = FastMCP("Ollama Local")

@mcp.tool()
def consultar_modelo_local(prompt: str) -> str:
    """Usa esta herramienta de Ollama para analizar código o generar modificaciones de la app."""
    try:
        response = requests.post(
            "http://127.0.0.1:11434/api/generate",
            json={
                "model": "qwen2.5-coder:7b",
                "prompt": prompt,
                "stream": False
            }
        )
        return response.json().get("response", "Error al generar respuesta")
    except Exception as e:
        return f"Error conectando a Ollama: {str(e)}"

if __name__ == "__main__":
    mcp.run()