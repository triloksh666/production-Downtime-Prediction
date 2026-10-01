"""
Alternative standard FastAPI entrypoint referencing main:app.
"""

from main import app

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
