import requests
from pydub import AudioSegment
from pydub.playback import play

# Voice URLs
BILL = 'https://api.elevenlabs.io/v1/text-to-speech/pqHfZKP75CvOlQylNhV4'
BRIAN = 'https://api.elevenlabs.io/v1/text-to-speech/nPczCjzI2devNBz1zQrb'
OMIN = 'https://api.elevenlabs.io/v1/text-to-speech/2gPFXx8pN3Avh27Dw5Ma'

# Configuration
CHUNK_SIZE = 5000
url = BILL  # Change as needed for the voice

# List of API keys (you can add more keys here)
api_keys = [
    "sk_e3cc19b41bc2f95c3301e9ff7e3cc1d55759ccf590d5daab",  # Replace with actual keys
    "sk_366345df47760a47882eeae81fec028db51a4a246c5ccaa7",
    "sk_e94942fe18f3d901acc950ae17782a1d1f607d2f85efc3ea",
    # Add other API keys as needed
]

# Variable to track which API key is currently in use
current_key_index = 0
headers = {
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
    "xi-api-key": api_keys[current_key_index]
}

def switch_api_key():
    global current_key_index, headers
    current_key_index = (current_key_index + 1) % len(api_keys)
    headers["xi-api-key"] = api_keys[current_key_index]
    print(f"Switched to API key #{current_key_index + 1}")

def text_to_speech(ai_response):
    data = {
        "text": ai_response,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0,
            "similarity_boost": 1,
            "style": 1,
            "use_speaker_boost": True
        }
    }

    while True:  # Retry until successful
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code == 200:
            with open('output.mp3', 'wb') as f:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if chunk:
                        f.write(chunk)

            audio = AudioSegment.from_file("output.mp3", format="mp3")
            play(audio)
            break  # Exit the loop if successful

        elif response.status_code == 401:
            print("API key likely out of credits or invalid. Switching to the next key...")
            switch_api_key()
        
        else:
            print("Text-to-speech request failed with status code:", response.status_code)
            print("Response:", response.text)
            break  # Exit the loop if error is unrelated to authorization (e.g., invalid model or text issue)