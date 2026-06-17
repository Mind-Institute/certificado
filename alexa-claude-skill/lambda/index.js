'use strict';

/**
 * Alexa Custom Skill -> Claude (API da Anthropic)
 *
 * Fluxo:
 *   1. Usuária abre a skill ("Alexa, abrir assistente inteligente").
 *   2. Fala uma pergunta -> capturada pelo slot AMAZON.SearchQuery.
 *   3. Mandamos a pergunta (+ histórico curto da conversa) para o Claude.
 *   4. A resposta do Claude é falada pela Alexa.
 *
 * Memória: o histórico da conversa fica em sessionAttributes, então o Claude
 * lembra do que foi dito ENQUANTO a sessão estiver aberta. Ao fechar a skill,
 * a memória zera (comportamento esperado para um assistente de voz simples).
 */

const Alexa = require('ask-sdk-core');
const Anthropic = require('@anthropic-ai/sdk');

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

// A chave NUNCA fica no código. Configure ANTHROPIC_API_KEY como variável de
// ambiente na Lambda (ou nas configurações da skill Alexa-hosted).
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Modelo. Default: claude-opus-4-8 (o mais capaz).
// Para respostas mais rápidas e baratas num assistente de voz, troque por
// claude-haiku-4-5 setando a env var MODEL.
const MODEL = process.env.MODEL || 'claude-opus-4-8';

// Quantos tokens a resposta pode ter. Voz pede respostas curtas; isso também
// ajuda a caber no limite de ~8 segundos de resposta da Alexa.
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '400', 10);

// Quantas mensagens de histórico manter (pares pergunta/resposta).
// 10 = ~5 trocas. Mantém o contexto sem estourar o tempo/custo.
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || '10', 10);

// Instruções de comportamento para o Claude, otimizadas para VOZ.
const SYSTEM_PROMPT = [
  'Você é um assistente de voz falando através da Alexa, em português do Brasil.',
  'Suas respostas serão LIDAS EM VOZ ALTA, então:',
  '- Seja direto e conciso. Responda em 1 a 3 frases curtas sempre que possível.',
  '- Não use markdown, emojis, listas com marcadores, asteriscos, links ou tabelas.',
  '- Escreva números e símbolos por extenso quando ajudar a leitura em voz alta.',
  '- Se a pergunta for ambígua, faça UMA pergunta curta de esclarecimento.',
  '- Se não souber, diga que não sabe, sem inventar.',
].join('\n');

const REPROMPT = 'Pode perguntar outra coisa, ou dizer "parar" para encerrar.';

// ---------------------------------------------------------------------------
// Núcleo: chamar o Claude
// ---------------------------------------------------------------------------

/**
 * Envia o histórico + a nova pergunta ao Claude e devolve o texto da resposta.
 * @param {Array<{role: string, content: string}>} history
 * @returns {Promise<string>}
 */
async function askClaude(history) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // effort baixo prioriza latência — importante para voz.
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: history,
  });

  // Concatena todos os blocos de texto da resposta.
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .trim();

  return text || 'Desculpe, não consegui pensar em uma resposta agora.';
}

/**
 * Lê o histórico dos sessionAttributes, garante limites e formato.
 */
function getHistory(handlerInput) {
  const attrs = handlerInput.attributesManager.getSessionAttributes();
  return Array.isArray(attrs.history) ? attrs.history : [];
}

/**
 * Salva o histórico de volta nos sessionAttributes, recortado ao tamanho máximo.
 */
function saveHistory(handlerInput, history) {
  const trimmed = history.slice(-MAX_HISTORY);
  const attrs = handlerInput.attributesManager.getSessionAttributes();
  attrs.history = trimmed;
  handlerInput.attributesManager.setSessionAttributes(attrs);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speak = 'Olá! Sou seu assistente inteligente. Pode perguntar.';
    return handlerInput.responseBuilder
      .speak(speak)
      .reprompt('O que você gostaria de perguntar?')
      .getResponse();
  },
};

const AskClaudeIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskClaudeIntent'
    );
  },
  async handle(handlerInput) {
    const query = Alexa.getSlotValue(handlerInput.requestEnvelope, 'query');

    if (!query) {
      return handlerInput.responseBuilder
        .speak('Não entendi sua pergunta. Pode repetir?')
        .reprompt('Pode repetir sua pergunta?')
        .getResponse();
    }

    const history = getHistory(handlerInput);
    history.push({ role: 'user', content: query });

    let answer;
    try {
      answer = await askClaude(history);
    } catch (error) {
      console.error('Erro ao chamar a API da Anthropic:', error);
      return handlerInput.responseBuilder
        .speak('Tive um problema para falar com o assistente. Pode tentar de novo?')
        .reprompt(REPROMPT)
        .getResponse();
    }

    history.push({ role: 'assistant', content: answer });
    saveHistory(handlerInput, history);

    return handlerInput.responseBuilder
      .speak(answer)
      .reprompt(REPROMPT)
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent'
    );
  },
  handle(handlerInput) {
    const speak =
      'É só me fazer uma pergunta, como "explique o que é segurança psicológica". ' +
      'O que você quer saber?';
    return handlerInput.responseBuilder
      .speak(speak)
      .reprompt('O que você quer saber?')
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent')
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak('Até logo!').withShouldEndSession(true).getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent'
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Não entendi. Pode reformular sua pergunta?')
      .reprompt('Pode reformular sua pergunta?')
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    const reason = handlerInput.requestEnvelope.request.reason;
    console.log(`Sessão encerrada: ${reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Erro não tratado:', error);
    return handlerInput.responseBuilder
      .speak('Desculpe, tive um problema. Pode tentar de novo?')
      .reprompt(REPROMPT)
      .getResponse();
  },
};

// ---------------------------------------------------------------------------
// Export (entrypoint da Lambda)
// ---------------------------------------------------------------------------

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AskClaudeIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('alexa-claude-skill/1.0')
  .lambda();
