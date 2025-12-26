import axios from 'axios';
import { getDashScopeApiKey } from './text';

const SENSEVOICE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';
const COSYVOICE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/generation';

/**
 * 语音转文字 (STT) - SenseVoice
 */
export async function dashscopeSTT(audioUrl: string): Promise<string> {
  const apiKey = getDashScopeApiKey();
  
  const payload = {
    model: 'sensevoice-v1',
    input: {
      audio_resource: audioUrl
    },
    parameters: {
      language_hints: ['zh', 'en']
    }
  };

  const resp = await axios.post(SENSEVOICE_API_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-Async': 'enable'
    }
  });

  if (resp.status !== 200) {
    throw new Error(`STT 任务提交失败: ${resp.statusText}`);
  }

  const taskId = resp.data.output.task_id;
  
  // 轮询结果
  return pollAudioTask(taskId);
}

/**
 * 文字转语音 (TTS) - CosyVoice
 */
export async function dashscopeTTS(text: string, voiceId: string = 'cosyvoice-v1'): Promise<string> {
  const apiKey = getDashScopeApiKey();
  
  const payload = {
    model: voiceId,
    input: {
      text
    },
    parameters: {
      voice: 'longxiaochun' // 默认音色，后续可配置
    }
  };

  const resp = await axios.post(COSYVOICE_API_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (resp.status !== 200) {
    throw new Error(`TTS 请求失败: ${resp.statusText}`);
  }

  return resp.data.output.audio_url;
}

async function pollAudioTask(taskId: string): Promise<string> {
  const apiKey = getDashScopeApiKey();
  const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  
  for (let i = 0; i < 30; i++) {
    const resp = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const status = resp.data.output.task_status;
    if (status === 'SUCCEEDED') {
      const resultUrl = resp.data.output.transcription_url;
      if (!resultUrl) throw new Error('未返回转写URL');
      
      const resultResp = await axios.get(resultUrl);
      // SenseVoice 格式通常在 transcription_url 指向的 JSON 中
      // 这里的结构可能因模型而异，通常是 { "transcripts": [ { "text": "..." } ] }
      const transcripts = resultResp.data.transcripts;
      if (Array.isArray(transcripts) && transcripts.length > 0) {
        return transcripts.map(t => t.text).join('');
      }
      return JSON.stringify(resultResp.data); // Fallback
    } else if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`音频任务失败: ${status}`);
    }
    
    await new Promise(res => setTimeout(res, 2000));
  }
  
  throw new Error('音频任务超时');
}

