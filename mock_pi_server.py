from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

app = FastAPI(title="Raspberry Pi Display Server")

# Allow requests from your main web app (running on port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the expected JSON structure
class DisplayData(BaseModel):
    category: str
    id: str
    name: str

@app.post("/display")
async def update_display(data: DisplayData):
    # Convert the received Pydantic model back to a standard Python dictionary
    payload_dict = data.model_dump() if hasattr(data, 'model_dump') else data.dict()
    
    # Format it as a pretty JSON string
    exact_json_received = json.dumps(payload_dict, indent=4)

    # Print to the terminal
    print("\n" + "="*50)
    print(exact_json_received)
    print("="*50 + "\n")
    
    return {"status": "success", "message": "Data displayed successfully", "received_data": payload_dict}

if __name__ == "__main__":
    import uvicorn
    # Run on port 8001 so it doesn't conflict with your main app
    uvicorn.run("mock_pi_server:app", host="127.0.0.1", port=8001, reload=True)