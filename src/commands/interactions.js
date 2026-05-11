import { MessageFlags } from 'discord.js';

export const EPHEMERAL_FLAG = MessageFlags.Ephemeral;
export const DEFAULT_INTERACTION_DEFER_AFTER_MS = 2_500;

export function isUnknownInteractionError(error) {
  return Boolean(
    error?.code === 10062
    || error?.rawError?.code === 10062
    || error?.message === 'Unknown interaction'
  );
}

export function isUserFacingInteractionError(error) {
  return error instanceof Error
    && error.constructor === Error
    && !isUnknownInteractionError(error);
}

export function toInteractionPayload(payload, { ephemeral = false, flags: optionFlags } = {}) {
  if (typeof payload === 'string') {
    const flags = ephemeral
      ? mergeMessageFlags(optionFlags, EPHEMERAL_FLAG)
      : optionFlags;
    return {
      content: payload,
      ...(flags === undefined ? {} : { flags })
    };
  }

  const source = payload ?? {};
  const {
    ephemeral: deprecatedEphemeral,
    flags,
    ...rest
  } = source;

  const mergedFlags = mergeOptionalMessageFlags(flags, optionFlags);

  if (ephemeral || deprecatedEphemeral) {
    return {
      ...rest,
      flags: mergeMessageFlags(mergedFlags, EPHEMERAL_FLAG)
    };
  }

  return {
    ...rest,
    ...(mergedFlags === undefined ? {} : { flags: mergedFlags })
  };
}

export async function safeReplyToInteraction(interaction, payload, options = {}) {
  const responsePayload = toInteractionPayload(payload, options);

  try {
    if (interaction.deferred && !interaction.replied) {
      if (isEphemeralInteractionPayload(responsePayload) && typeof interaction.followUp === 'function') {
        await interaction.followUp(toFollowOnInteractionPayload(responsePayload));
      } else if (typeof interaction.editReply === 'function') {
        await interaction.editReply(toFollowOnInteractionPayload(responsePayload));
      } else if (typeof interaction.followUp === 'function') {
        await interaction.followUp(toFollowOnInteractionPayload(responsePayload));
      } else {
        await interaction.reply(responsePayload);
      }
    } else if (interaction.replied) {
      if (typeof interaction.followUp === 'function') {
        await interaction.followUp(toFollowOnInteractionPayload(responsePayload));
      } else if (typeof interaction.editReply === 'function') {
        await interaction.editReply(toFollowOnInteractionPayload(responsePayload));
      } else {
        await interaction.reply(responsePayload);
      }
    } else {
      await interaction.reply(responsePayload);
    }
    return true;
  } catch (error) {
    if (isUnknownInteractionError(error)) {
      return false;
    }
    throw error;
  }
}

export function guardInteractionResponse(interaction, {
  deferAfterMs = DEFAULT_INTERACTION_DEFER_AFTER_MS,
  logger = console,
  enabled = true
} = {}) {
  const originalReply = typeof interaction?.reply === 'function'
    ? interaction.reply.bind(interaction)
    : null;
  const originalDeferReply = typeof interaction?.deferReply === 'function'
    ? interaction.deferReply.bind(interaction)
    : null;
  const originalEditReply = typeof interaction?.editReply === 'function'
    ? interaction.editReply.bind(interaction)
    : null;
  const originalFollowUp = typeof interaction?.followUp === 'function'
    ? interaction.followUp.bind(interaction)
    : null;
  const shouldGuard = Boolean(
    enabled
      && originalReply
      && originalDeferReply
      && interaction?.isChatInputCommand?.()
      && Number.isFinite(deferAfterMs)
      && deferAfterMs >= 0
  );

  if (!shouldGuard) {
    return {
      stop() {},
      get autoDeferred() {
        return false;
      }
    };
  }

  let stopped = false;
  let timer = null;
  let autoDeferPromise = null;
  let autoDeferred = false;
  let deferredByGuard = false;
  let repliedByGuard = false;

  const hasDeferred = () => Boolean(interaction.deferred || deferredByGuard);
  const hasReplied = () => Boolean(interaction.replied || repliedByGuard);
  const hasResponded = () => hasDeferred() || hasReplied();

  const clearAutoDeferTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const waitForAutoDefer = async () => {
    if (autoDeferPromise) await autoDeferPromise;
  };

  const startAutoDefer = () => {
    if (stopped || hasResponded() || autoDeferPromise) return;

    autoDeferPromise = (async () => {
      try {
        if (stopped || hasResponded()) return false;
        await originalDeferReply();
        autoDeferred = true;
        deferredByGuard = true;
        logger.debug?.('Auto-deferred Discord command interaction before the response window closed.', {
          commandName: interaction.commandName
        });
        return true;
      } catch (error) {
        if (isUnknownInteractionError(error)) {
          logger.warn?.('Interaction expired before automatic defer could be sent.');
        } else {
          logger.warn?.('Failed to automatically defer interaction:', error);
        }
        return false;
      }
    })();
  };

  timer = setTimeout(startAutoDefer, deferAfterMs);
  timer.unref?.();

  interaction.deferReply = async function guardedDeferReply(...args) {
    clearAutoDeferTimer();
    await waitForAutoDefer();
    if (hasResponded()) return null;

    const result = await originalDeferReply(...args);
    deferredByGuard = true;
    return result;
  };

  interaction.reply = async function guardedReply(payload) {
    clearAutoDeferTimer();
    await waitForAutoDefer();

    if (hasDeferred() && !hasReplied()) {
      const followOnPayload = toFollowOnInteractionPayload(payload);
      if (isEphemeralInteractionPayload(followOnPayload) && originalFollowUp) {
        const result = await originalFollowUp(followOnPayload);
        repliedByGuard = true;
        return result;
      }
      if (originalEditReply) {
        const result = await originalEditReply(followOnPayload);
        repliedByGuard = true;
        return result;
      }
      if (originalFollowUp) {
        const result = await originalFollowUp(followOnPayload);
        repliedByGuard = true;
        return result;
      }
    }

    if (hasReplied()) {
      const followOnPayload = toFollowOnInteractionPayload(payload);
      if (originalFollowUp) return originalFollowUp(followOnPayload);
      if (originalEditReply) return originalEditReply(followOnPayload);
    }

    const result = await originalReply(payload);
    repliedByGuard = true;
    return result;
  };

  if (originalEditReply) {
    interaction.editReply = async function guardedEditReply(payload) {
      clearAutoDeferTimer();
      await waitForAutoDefer();
      const result = await originalEditReply(toFollowOnInteractionPayload(payload));
      repliedByGuard = true;
      return result;
    };
  }

  if (originalFollowUp) {
    interaction.followUp = async function guardedFollowUp(payload) {
      clearAutoDeferTimer();
      await waitForAutoDefer();
      const result = await originalFollowUp(toFollowOnInteractionPayload(payload));
      repliedByGuard = true;
      return result;
    };
  }

  return {
    stop() {
      stopped = true;
      clearAutoDeferTimer();
    },
    get autoDeferred() {
      return autoDeferred;
    }
  };
}

export async function safeAutocompleteRespond(interaction, choices) {
  try {
    await interaction.respond(choices);
    return true;
  } catch (error) {
    if (isUnknownInteractionError(error)) {
      return false;
    }
    throw error;
  }
}

export async function safeDeferUpdate(interaction) {
  if (interaction.deferred || interaction.replied) return true;
  if (typeof interaction.deferUpdate !== 'function') return true;

  try {
    await interaction.deferUpdate();
    return true;
  } catch (error) {
    if (isUnknownInteractionError(error)) {
      return false;
    }
    throw error;
  }
}

export async function sendInteractionUpdate(interaction, payload) {
  const responsePayload = toInteractionPayload(payload);

  try {
    if (interaction.deferred || interaction.replied) {
      if (typeof interaction.editReply === 'function') {
        await interaction.editReply(responsePayload);
        return true;
      }
      if (typeof interaction.followUp === 'function') {
        await interaction.followUp(responsePayload);
        return true;
      }
      await interaction.reply(responsePayload);
      return true;
    }

    if (typeof interaction.update === 'function') {
      await interaction.update(responsePayload);
      return true;
    }

    await interaction.reply(responsePayload);
    return true;
  } catch (error) {
    if (isUnknownInteractionError(error)) {
      return false;
    }
    throw error;
  }
}

export function logUnexpectedInteractionError(logger, error, message = 'Interaction handling failed') {
  if (isUnknownInteractionError(error)) {
    logger.warn?.(`${message}: interaction expired before a response could be sent.`);
    return;
  }

  if (isUserFacingInteractionError(error)) {
    logger.warn?.(`${message}: ${error.message}`);
    return;
  }

  logger.error?.(message, error);
}

function mergeMessageFlags(flags, nextFlag) {
  if (flags === undefined || flags === null) return nextFlag;
  if (typeof flags === 'number') return flags | nextFlag;
  if (typeof flags === 'bigint') return flags | BigInt(nextFlag);
  return nextFlag;
}

function mergeOptionalMessageFlags(flags, nextFlags) {
  if (nextFlags === undefined || nextFlags === null) return flags;
  if (flags === undefined || flags === null) return nextFlags;
  if (typeof flags === 'number' && typeof nextFlags === 'number') return flags | nextFlags;
  if (typeof flags === 'bigint' && typeof nextFlags === 'bigint') return flags | nextFlags;
  return nextFlags;
}

function toFollowOnInteractionPayload(payload) {
  if (typeof payload === 'string') return payload;

  const {
    fetchReply,
    withResponse,
    ...rest
  } = payload ?? {};

  return rest;
}

function isEphemeralInteractionPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.ephemeral) return true;

  const flags = payload.flags;
  if (typeof flags === 'number') return Boolean(flags & EPHEMERAL_FLAG);
  if (typeof flags === 'bigint') return Boolean(flags & BigInt(EPHEMERAL_FLAG));
  if (typeof flags?.has === 'function') return flags.has(EPHEMERAL_FLAG);

  return false;
}
