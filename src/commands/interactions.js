import { MessageFlags } from 'discord.js';

export const EPHEMERAL_FLAG = MessageFlags.Ephemeral;
export const DEFAULT_INTERACTION_DEFER_AFTER_MS = 1_000;
const GUARD_DEFER_KIND = Symbol('guardDeferKind');
const GUARD_ORIGINAL_REPLY_FILLED = Symbol('guardOriginalReplyFilled');
const GUARD_DEFER_REPLY_EPHEMERAL = Symbol('guardDeferReplyEphemeral');

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
      if (shouldUseFollowUpAfterDeferredResponse(interaction, responsePayload)
        && typeof interaction.followUp === 'function') {
        await interaction.followUp(toFollowOnInteractionPayload(responsePayload));
        await deleteDeferredReplyIfPossible(interaction);
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
  const originalUpdate = typeof interaction?.update === 'function'
    ? interaction.update.bind(interaction)
    : null;
  const originalDeferUpdate = typeof interaction?.deferUpdate === 'function'
    ? interaction.deferUpdate.bind(interaction)
    : null;
  const originalShowModal = typeof interaction?.showModal === 'function'
    ? interaction.showModal.bind(interaction)
    : null;
  const originalDeleteReply = typeof interaction?.deleteReply === 'function'
    ? interaction.deleteReply.bind(interaction)
    : null;
  const canDeferReply = Boolean(
    originalReply
      && originalDeferReply
      && (interaction?.isChatInputCommand?.() || interaction?.isModalSubmit?.())
  );
  const canDeferUpdate = Boolean(
    originalUpdate
      && originalDeferUpdate
      && (interaction?.isButton?.() || interaction?.isStringSelectMenu?.())
  );
  const shouldGuard = Boolean(
    enabled
      && (canDeferReply || canDeferUpdate)
      && Number.isFinite(deferAfterMs)
      && deferAfterMs >= 0
  );

  if (!shouldGuard) {
    return {
      stop() {},
      async deferNow() {
        return true;
      },
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
  let updatedByGuard = false;
  let modalShownByGuard = false;
  let deferKind = null;

  const hasDeferred = () => Boolean(interaction.deferred || deferredByGuard);
  const hasReplied = () => Boolean(
    interaction.replied
      || repliedByGuard
      || updatedByGuard
      || modalShownByGuard
  );
  const hasResponded = () => hasDeferred() || hasReplied();

  const clearAutoDeferTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const waitForAutoDefer = async () => {
    if (!autoDeferPromise) return true;
    return autoDeferPromise;
  };

  const preferredAutoDeferKind = () => (
    canDeferUpdate ? 'update' : 'reply'
  );

  const markOriginalReplyFilled = () => {
    if (deferKind === 'reply') {
      interaction[GUARD_ORIGINAL_REPLY_FILLED] = true;
    }
  };

  const deferInitialResponse = async ({
    auto = false,
    kind = preferredAutoDeferKind()
  } = {}) => {
    if (stopped || hasResponded()) return true;

    try {
      if (kind === 'update' && canDeferUpdate) {
        await originalDeferUpdate();
        deferKind = 'update';
      } else if (canDeferReply) {
        await originalDeferReply();
        deferKind = 'reply';
        interaction[GUARD_DEFER_REPLY_EPHEMERAL] = false;
      } else if (canDeferUpdate) {
        await originalDeferUpdate();
        deferKind = 'update';
      } else {
        return true;
      }

      autoDeferred = auto;
      deferredByGuard = true;
      interaction[GUARD_DEFER_KIND] = deferKind;
      if (auto) {
        logger.debug?.(
          'Auto-deferred Discord interaction before the response window closed.',
          {
            commandName: interaction.commandName,
            customId: interaction.customId,
            deferKind
          }
        );
      }
      return true;
    } catch (error) {
      if (isUnknownInteractionError(error)) {
        logger.warn?.(
          auto
            ? 'Interaction expired before automatic defer could be sent.'
            : 'Interaction expired before initial defer could be sent.'
        );
        return false;
      }

      if (auto) {
        logger.warn?.('Failed to automatically defer interaction:', error);
        return false;
      }

      throw error;
    }
  };

  const startAutoDefer = () => {
    if (stopped || hasResponded() || autoDeferPromise) return;
    autoDeferPromise = deferInitialResponse({ auto: true });
  };

  timer = setTimeout(startAutoDefer, deferAfterMs);
  timer.unref?.();

  if (originalDeferReply) {
    interaction.deferReply = async function guardedDeferReply(...args) {
      clearAutoDeferTimer();
      await waitForAutoDefer();
      if (hasResponded()) return null;

      const result = await originalDeferReply(...args);
      deferredByGuard = true;
      deferKind = 'reply';
      interaction[GUARD_DEFER_KIND] = deferKind;
      interaction[GUARD_DEFER_REPLY_EPHEMERAL] = isEphemeralInteractionPayload(args[0]);
      return result;
    };
  }

  if (originalDeferUpdate) {
    interaction.deferUpdate = async function guardedDeferUpdate(...args) {
      clearAutoDeferTimer();
      await waitForAutoDefer();
      if (hasResponded()) return null;

      const result = await originalDeferUpdate(...args);
      deferredByGuard = true;
      deferKind = 'update';
      interaction[GUARD_DEFER_KIND] = deferKind;
      return result;
    };
  }

  if (originalReply) {
    interaction.reply = async function guardedReply(payload) {
      clearAutoDeferTimer();
      await waitForAutoDefer();

      if (hasDeferred() && !hasReplied()) {
        const followOnPayload = toFollowOnInteractionPayload(payload);
        if (deferKind === 'update') {
          if (originalFollowUp) {
            const result = await originalFollowUp(followOnPayload);
            repliedByGuard = true;
            return result;
          }
          if (originalEditReply) {
            const result = await originalEditReply(followOnPayload);
            repliedByGuard = true;
            return result;
          }
        }
        if (isEphemeralInteractionPayload(followOnPayload)
          && !interaction[GUARD_DEFER_REPLY_EPHEMERAL]
          && originalFollowUp) {
          const result = await originalFollowUp(followOnPayload);
          repliedByGuard = true;
          await deleteOriginalDeferredReply();
          return result;
        }
        if (originalEditReply) {
          const result = await originalEditReply(followOnPayload);
          markOriginalReplyFilled();
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
      if (!hasDeferred()) interaction[GUARD_ORIGINAL_REPLY_FILLED] = true;
      repliedByGuard = true;
      return result;
    };
  }

  if (originalUpdate) {
    interaction.update = async function guardedUpdate(payload) {
      clearAutoDeferTimer();
      await waitForAutoDefer();

      const followOnPayload = toFollowOnInteractionPayload(payload);

      if (hasDeferred() && !hasReplied()) {
        if (originalEditReply) {
          const result = await originalEditReply(followOnPayload);
          markOriginalReplyFilled();
          updatedByGuard = true;
          return result;
        }
        if (originalFollowUp) {
          const result = await originalFollowUp(followOnPayload);
          updatedByGuard = true;
          return result;
        }
      }

      if (hasReplied()) {
        if (originalEditReply) return originalEditReply(followOnPayload);
        if (originalFollowUp) return originalFollowUp(followOnPayload);
      }

      const result = await originalUpdate(payload);
      if (!hasDeferred()) interaction[GUARD_ORIGINAL_REPLY_FILLED] = true;
      updatedByGuard = true;
      return result;
    };
  }

  if (originalEditReply) {
    interaction.editReply = async function guardedEditReply(payload) {
      clearAutoDeferTimer();
      await waitForAutoDefer();
      const result = await originalEditReply(toFollowOnInteractionPayload(payload));
      markOriginalReplyFilled();
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

  if (originalShowModal) {
    interaction.showModal = async function guardedShowModal(...args) {
      clearAutoDeferTimer();
      await waitForAutoDefer();
      if (hasResponded()) {
        logger.warn?.('Cannot show modal after the interaction was already acknowledged.');
        return null;
      }

      const result = await originalShowModal(...args);
      modalShownByGuard = true;
      return result;
    };
  }

  const deleteOriginalDeferredReply = async () => {
    if (deferKind !== 'reply' || !originalDeleteReply) return;
    if (interaction[GUARD_ORIGINAL_REPLY_FILLED]) return;
    try {
      await originalDeleteReply();
    } catch (error) {
      logger.debug?.('Failed to delete deferred interaction placeholder:', error);
    }
  };

  return {
    stop() {
      stopped = true;
      clearAutoDeferTimer();
    },
    async deferNow() {
      clearAutoDeferTimer();
      if (hasResponded()) return true;
      if (!autoDeferPromise) {
        autoDeferPromise = deferInitialResponse({ auto: false });
      }
      return waitForAutoDefer();
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

function shouldUseFollowUpAfterDeferredResponse(interaction, payload) {
  return interaction?.[GUARD_DEFER_KIND] === 'update'
    || (isEphemeralInteractionPayload(payload) && !interaction?.[GUARD_DEFER_REPLY_EPHEMERAL]);
}

async function deleteDeferredReplyIfPossible(interaction) {
  if (interaction?.[GUARD_DEFER_KIND] !== 'reply') return;
  if (interaction?.[GUARD_ORIGINAL_REPLY_FILLED]) return;
  if (typeof interaction?.deleteReply !== 'function') return;

  try {
    await interaction.deleteReply();
  } catch {
    // Best-effort cleanup only. The user-facing follow-up was already sent.
  }
}
