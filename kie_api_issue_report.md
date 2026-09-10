# KIE API Integration Issue Report

## Description

I'm trying to integrate with the KIE API using my API key, but I'm facing consistent errors. The API documentation is very limited, and I'm unable to find the correct endpoint and model name combinations.

## API Key

API Key: d4cff097f873bf763ef7d6c08402eb80

## Errors Encountered

### 1. `/v1/chat/completions` endpoint
```
Status: 200
Response: {"code":422,"msg":"The model is not supported","data":null}
```

**Models tested**:
- claude-haiku-4-5
- claude-3-haiku-20240307
- claude-3-sonnet-20240229
- claude-3-opus-20240229
- gpt-4o
- gpt-4o-mini
- gpt-4-turbo
- gpt-3.5-turbo
- llama-3.1-70b-instruct
- llama-3.1-8b-instruct
- deepseek-chat

### 2. `/claude/v1/messages` endpoint
```
Status: 503 or 200 with internal error
Response: {"type":"error","error":{"type":"api_error","message":"Internal error, please try again later"}}
```

### 3. `/v1/completions` and `/v1/image/generate` endpoints
```
Status: 404
Response: {"timestamp":1789042120514,"status":404,"error":"Not Found","message":"No message available","path":"/v1/completions"}
```

### 4. `/api/v1/models` endpoint
```
Status: 200 with 401 error
Response: {"code":401,"msg":"Unauthorized – Authentication failed. Please check that your Authorization and Content-Type headers are correctly set."}
```

## Requests Tried

### 1. Simple Chat Request
```bash
curl --location 'https://api.kie.ai/v1/chat/completions' \
--header 'Authorization: Bearer d4cff097f873bf763ef7d6c08402eb80' \
--header 'Content-Type: application/json' \
--data '{
    "model": "claude-haiku-4-5",
    "prompt": "What is 2+2?",
    "max_tokens": 100
}'
```

**Response**:
```
{"code":422,"msg":"The model is not supported","data":null}
```

### 2. Claude Messages Request
```bash
curl --location 'https://api.kie.ai/claude/v1/messages' \
--header 'Authorization: Bearer d4cff097f873bf763ef7d6c08402eb80' \
--header 'Content-Type: application/json' \
--data '{
    "model": "claude-haiku-4-5",
    "messages": [
        {
            "role": "user",
            "content": "What is 2+2?"
        }
    ],
    "thinkingFlag": false,
    "stream": false,
    "max_tokens": 100
}'
```

**Response**:
```
{"type":"error","error":{"type":"api_error","message":"Internal error, please try again later"}}
```

## Expected Behavior

I should be able to:
1. Make chat completions using Claude models (like claude-haiku-4-5)
2. Generate images using models like stable-diffusion or flux
3. Check the list of available models

## Environment

- Python 3.12
- httpx 0.27.0

## Steps to Reproduce

1. Set `KIE_KEY` environment variable to my API key
2. Run the provided Python scripts or curl commands
3. Observe the errors

## Additional Information

- The API key is active and works for authentication
- The `/v1/chat/completions` endpoint is accepting requests but not recognizing any model names
- `/claude/v1/messages` is returning internal errors
- Image generation endpoints are not found

## Request to KIE Support

Could you please provide:

1. **A list of supported models** for chat completion and image generation
2. **Correct endpoint URLs** for each model type
3. **API format specifications** (JSON payload structure)
4. **Any authentication requirements** for the model list endpoint
5. **An example working API request** using curl or Python

Your help is greatly appreciated. This integration is crucial for my project.