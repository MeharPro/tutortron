import requests
import json
import base64
from tts import text_to_speech

def encode_image_to_base64(filepath):
    with open(filepath, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def get_ai_response(image_base64, user_input):
    OPENROUTER_API_KEY = "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"
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        },
        data=json.dumps({
            "model": "meta-llama/llama-3.2-90b-vision-instruct:free",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_input
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ]
        })
    )
    
    if response.status_code == 200:
        response_data = response.json()
        return response_data["choices"][0]["message"]["content"]
    else:
        print("Request failed with status code:", response.status_code)
        print("Response:", response.text)
        return None

# Main loop for user input
while True:
    user_input = input("Enter your question or type 'exit' to quit: ")
    if user_input.lower() == "exit":
        break

    image_base64 = encode_image_to_base64("teddy.jpeg")  # Update to your image file path
    ai_response = get_ai_response(image_base64, user_input)

    if ai_response:
        print("AI Response:", ai_response)
        text_to_speech(ai_response)  # Call the text_to_speech function to convert response to audio