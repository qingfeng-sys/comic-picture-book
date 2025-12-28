/**
 * 全局功能开关配置 (Feature Flags)
 * 用于在生产环境上线前隐藏或禁用尚未完全准备好的功能。
 */

export const FEATURE_FLAGS = {
  // 语音相关功能总开关
  ENABLE_SPEECH: process.env.NEXT_PUBLIC_ENABLE_SPEECH === 'true',
  
  // 细分开关 (如果需要单独控制)
  ENABLE_STT: process.env.NEXT_PUBLIC_ENABLE_STT === 'true',
  ENABLE_TTS: process.env.NEXT_PUBLIC_ENABLE_TTS === 'true',
  ENABLE_VOICE_CLONING: process.env.NEXT_PUBLIC_ENABLE_VOICE_CLONING === 'true',
};

/**
 * 辅助方法：检查语音功能是否可用
 */
export const isSpeechEnabled = () => {
  return FEATURE_FLAGS.ENABLE_SPEECH;
};

