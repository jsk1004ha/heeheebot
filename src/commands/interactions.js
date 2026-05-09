import { MessageFlags } from 'discord.js';

export const EPHEMERAL_FLAG = MessageFlags.Ephemeral;

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
    if (interaction.deferred || interaction.replied) {
      if (typeof interaction.followUp === 'function') {
        await interaction.followUp(responsePayload);
      } else if (typeof interaction.editReply === 'function') {
        await interaction.editReply(responsePayload);
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
