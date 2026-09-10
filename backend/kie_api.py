import os
import httpx
import json
import time
import logging
from typing import Optional

logger = logging.getLogger("uvicorn")

class KIEAPI:
    """
    KIE API client for interacting with KIE models.
    Documentation: https://kie.ai/market
    """
    
    BASE_URL = "https://api.kie.ai"
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize KIE API client.
        
        Args:
            api_key: KIE API key. If not provided, will use KIE_KEY environment variable.
        """
        self.api_key = api_key or os.getenv("KIE_KEY")
        if not self.api_key:
            raise ValueError("KIE API key is required (either via parameter or KIE_KEY environment variable)")
        
        self.client = httpx.Client(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=60.0
        )
    
    def _make_request(self, endpoint: str, payload: dict) -> dict:
        """
        Make a request to KIE API.
        
        Args:
            endpoint: API endpoint
            payload: Request payload
            
        Returns:
            Response data
            
        Raises:
            Exception: If request fails
        """
        try:
            response = self.client.post(endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"KIE API HTTP error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"KIE API error: {str(e)}")
            raise
    
    def create_task(self, model: str, prompt: str, **kwargs) -> dict:
        """
        Create a new generation task.
        
        Args:
            model: Model name from KIE market (e.g., "gpt-4o", "claude-3-opus")
            prompt: Input prompt
            **kwargs: Additional parameters (e.g., temperature, max_tokens, webhook)
            
        Returns:
            Task information with task_id
            
        Example:
            {
                "code": 0,
                "msg": "success",
                "data": {
                    "task_id": "xxx",
                    "status": "pending"
                }
            }
        """
        payload = {
            "model": model,
            "prompt": prompt,
            **kwargs
        }
        
        return self._make_request("/v1/chat/completions", payload)
    
    def get_task_status(self, task_id: str) -> dict:
        """
        Get task status and results.
        
        Args:
            task_id: Task ID from create_task
            
        Returns:
            Task status and results
            
        Example:
            {
                "code": 0,
                "msg": "success",
                "data": {
                    "task_id": "xxx",
                    "status": "completed",
                    "result": "Generated text..."
                }
            }
        """
        return self._make_request("/v1/task/query", {"task_id": task_id})
    
    def wait_for_completion(self, task_id: str, timeout: int = 300, poll_interval: float = 2.0) -> dict:
        """
        Wait for task completion with polling.
        
        Args:
            task_id: Task ID
            timeout: Maximum time to wait in seconds
            poll_interval: Polling interval in seconds
            
        Returns:
            Completed task data
            
        Raises:
            TimeoutError: If task doesn't complete within timeout
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                task_status = self.get_task_status(task_id)
                
                if task_status.get("code") == 0:
                    status = task_status.get("data", {}).get("status")
                    
                    if status == "completed":
                        return task_status
                    elif status == "failed":
                        raise Exception(f"Task failed: {task_status.get('msg', 'Unknown error')}")
                
                time.sleep(poll_interval)
            except Exception as e:
                logger.warning(f"Error checking task status: {str(e)}. Retrying...")
                time.sleep(poll_interval)
        
        raise TimeoutError(f"Task did not complete within {timeout} seconds")
    
    def generate(self, model: str, prompt: str, **kwargs) -> str:
        """
        Simple synchronous generation method with polling.
        
        Args:
            model: Model name
            prompt: Input prompt
            **kwargs: Additional parameters
            
        Returns:
            Generated text
        """
        # Create task
        task_response = self.create_task(model, prompt, **kwargs)
        
        if task_response.get("code") != 0:
            raise Exception(f"Failed to create task: {task_response.get('msg', 'Unknown error')}")
        
        task_id = task_response.get("data", {}).get("task_id")
        if not task_id:
            raise Exception("Task ID not returned from KIE API")
        
        # Wait for completion
        completion_response = self.wait_for_completion(task_id)
        
        return completion_response.get("data", {}).get("result", "")
    
    def chat_completion(self, model: str, messages: list, **kwargs) -> str:
        """
        Chat completion using message format.
        
        Args:
            model: Model name
            messages: List of messages in OpenAI format
            **kwargs: Additional parameters
            
        Returns:
            Generated text
        """
        # Convert messages to prompt format
        prompt = ""
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            prompt += f"{role}: {content}\n"
        
        return self.generate(model, prompt, **kwargs)


# Singleton instance
_kie_client = None

def get_kie_client() -> KIEAPI:
    """
    Get singleton KIE API client instance.
    
    Returns:
        KIEAPI instance
    """
    global _kie_client
    
    if _kie_client is None:
        try:
            _kie_client = KIEAPI()
        except Exception as e:
            logger.warning(f"Failed to initialize KIE client: {str(e)}")
            _kie_client = None
    
    return _kie_client


def is_kie_available() -> bool:
    """
    Check if KIE API is available.
    
    Returns:
        True if KIE API key is configured and client can be initialized
    """
    return get_kie_client() is not None