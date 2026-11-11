export type TranslatorVoice = 'male' | 'female';
export type TranslationDirection = 'out' | 'in';

export function translationLanguages(direction: TranslationDirection, customerLanguage: string) {
  return direction === 'in'
    ? { sourceLang: 'auto', targetLang: 'čeština' }
    : { sourceLang: 'čeština', targetLang: customerLanguage };
}

export function translatorVoiceName(voice: TranslatorVoice) {
  return voice === 'male' ? 'Charon' : 'Kore';
}

export function translatorAudioKey(text: string, voice: TranslatorVoice) {
  return JSON.stringify([text, voice]);
}