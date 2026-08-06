//! External LLM providers (BYOK) — OpenAI-compatible chat APIs via reqwest.
//! Mirrors `backend/app/ai/providers.py`.

use serde_json::{json, Value};

pub struct LlmProvider;

impl LlmProvider {
    /// Call the configured LLM (OpenAI/DeepSeek/Anthropic-compatible/Ollama).
    pub async fn call(
        settings: &Value,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Option<String> {
        let key = settings
            .get("ai_api_key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if key.is_empty() {
            return None;
        }
        let provider = settings
            .get("ai_provider")
            .and_then(|v| v.as_str())
            .unwrap_or("openai");

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(45))
            .build()
            .ok()?;

        let messages = json!([
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt },
        ]);

        if provider == "ollama" {
            let base = settings
                .get("ai_base_url")
                .and_then(|v| v.as_str())
                .unwrap_or("http://localhost:11434")
                .trim_end_matches('/')
                .to_string();
            let url = format!("{base}/api/chat");
            let model = settings
                .get("ai_model")
                .and_then(|v| v.as_str())
                .unwrap_or("llama3");
            let payload = json!({ "model": model, "messages": messages, "stream": false });
            let resp = client.post(&url).json(&payload).send().await.ok()?;
            let data: Value = resp.json().await.ok()?;
            return data
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .map(|s| s.to_string());
        }

        let (base, model) = if provider == "deepseek" {
            (
                settings
                    .get("ai_base_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("https://api.deepseek.com/v1"),
                settings
                    .get("ai_model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("deepseek-chat"),
            )
        } else {
            (
                settings
                    .get("ai_base_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("https://api.openai.com/v1"),
                settings
                    .get("ai_model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("gpt-4o-mini"),
            )
        };
        let url = format!("{}/chat/completions", base.trim_end_matches('/'));
        let payload = json!({ "model": model, "messages": messages, "temperature": 0.3 });

        let resp = client
            .post(&url)
            .bearer_auth(&key)
            .json(&payload)
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let data: Value = resp.json().await.ok()?;
        data.get("choices")
            .and_then(|c| c.as_array())
            .and_then(|a| a.first())
            .and_then(|ch| ch.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
    }

    /// Extract a JSON object from a model reply (strips code fences).
    pub fn extract_json(reply: &str) -> Option<Value> {
        let trimmed = reply.trim();
        let start = trimmed.find('{')?;
        let end = trimmed.rfind('}')?;
        serde_json::from_str(&trimmed[start..=end]).ok()
    }
}
