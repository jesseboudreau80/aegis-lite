export const APP_NAME = 'Aegis Lite'
export const APP_VERSION = '1.0.0'
export const AEGIS_EDITION = 'lite'

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  claude_opus:          'Claude Opus',
  claude_sonnet:        'Claude Sonnet',
  gpt4o:                'GPT-4o',
  gpt4o_mini:           'GPT-4o Mini',
  mistral:              'Mistral 7B',
  llama3:               'Llama 3.1',
  gemini:               'Gemini Flash',
  kimi:                 'Kimi',
  perplexity_sonar:     'Perplexity Sonar',
  perplexity_sonar_pro: 'Perplexity Sonar Pro',
}

export const RISK_COLORS: Record<string, string> = {
  low:      'text-green-400',
  medium:   'text-yellow-400',
  high:     'text-orange-400',
  critical: 'text-red-400',
}

export const SEVERITY_COLORS: Record<string, string> = {
  info:     'text-blue-400',
  warning:  'text-yellow-400',
  critical: 'text-red-400',
}

export const DECISION_COLORS: Record<string, string> = {
  allow:    'text-green-400',
  warn:     'text-yellow-400',
  modify:   'text-blue-400',
  escalate: 'text-orange-400',
  block:    'text-red-400',
}
