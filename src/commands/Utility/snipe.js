import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

/*
 * ============================================================
 * MEGA TEST - STANDALONE SNIPE SYSTEM
 * ============================================================
 *
 * PREFIX COMMANDS:
 *
 *   !snipe
 *   !snipe 1
 *   !snipe 2
 *   !snipe 3
 *   ...
 *
 *   !snipe clear
 *
 * SLASH COMMANDS:
 *
 *   /snipe
 *   /snipe when:2
 *   /snipe when:3
 *   ...
 *
 *   /snipe clear
 *
 * ============================================================
 *
 * IMPORTANT:
 *
 * This file is designed to be standalone.
 *
 * The snipe cache is kept in RAM.
 * Restarting the bot clears the cache.
 *
 * Maximum:
 *   100 deleted messages PER CHANNEL
 *
 * Bot messages:
 *   NEVER cached.
 *
 * ============================================================
 */


// ============================================================
// CONFIGURATION
// ============================================================

const PREFIX = "!";

/*
 * Maximum number of deleted messages stored for each channel.
 *
 * Example:
 *
 * Channel A -> 100 messages
 * Channel B -> 100 messages
 * Channel C -> 100 messages
 *
 * The cache is NOT global.
 */
const MAX_SNIPES_PER_CHANNEL = 100;


/*
 * How long deleted messages remain in the cache.
 *
 * 1 hour.
 *
 * Change this if you want:
 *
 * 30 minutes:
 * 30 * 60 * 1000
 *
 * 6 hours:
 * 6 * 60 * 60 * 1000
 *
 * 24 hours:
 * 24 * 60 * 60 * 1000
 */
const MAX_SNIPE_AGE = 60 * 60 * 1000;


/*
 * Maximum amount of text displayed in the embed.
 */
const MAX_CONTENT_LENGTH = 4000;


// ============================================================
// CACHE
// ============================================================
//
// channelId -> deleted messages
//
// The newest deleted message is always index 0.
//
// Example:
//
// channelId:
// [
//   newest deleted message,
//   second newest,
//   third newest
// ]
//
// ============================================================

const snipeCache = new Map();


// ============================================================
// ADD MESSAGE TO CACHE
// ============================================================

function addSnipe(message) {
  if (!message) return;

  /*
   * A message without a channel cannot be sniped.
   */
  if (!message.channelId) return;


  /*
   * IMPORTANT:
   *
   * Never cache messages sent by the bot.
   */
  if (message.author?.bot === true) {
    return;
  }


  const deletedTimestamp = Date.now();


  const entry = {
    id: message.id ?? null,

    channelId: message.channelId,

    guildId: message.guildId ?? null,


    // --------------------------------------------------------
    // AUTHOR
    // --------------------------------------------------------

    author: {
      id: message.author?.id ?? null,

      username:
        message.author?.username ??
        message.author?.tag ??
        "Unknown User",

      tag:
        message.author?.tag ??
        message.author?.username ??
        "Unknown User",

      avatarURL:
        typeof message.author?.displayAvatarURL === "function"
          ? message.author.displayAvatarURL({
              extension: "png",
              size: 128,
            })
          : null,
    },


    // --------------------------------------------------------
    // CONTENT
    // --------------------------------------------------------

    content: message.content ?? "",


    // --------------------------------------------------------
    // TIMESTAMPS
    // --------------------------------------------------------

    createdTimestamp:
      message.createdTimestamp ??
      deletedTimestamp,

    deletedTimestamp,


    // --------------------------------------------------------
    // ATTACHMENTS
    // --------------------------------------------------------

    attachments: Array.from(
      message.attachments?.values?.() ?? []
    ).map((attachment) => ({
      name:
        attachment.name ??
        "attachment",

      url:
        attachment.url,

      contentType:
        attachment.contentType ??
        null,

      size:
        attachment.size ??
        null,
    })),


    // --------------------------------------------------------
    // EMBEDS
    // --------------------------------------------------------

    embeds: Array.from(
      message.embeds ?? []
    )
      .map((embed) => {
        try {
          return embed.toJSON();
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  };


  // ----------------------------------------------------------
  // GET CHANNEL CACHE
  // ----------------------------------------------------------

  let channelSnipes =
    snipeCache.get(message.channelId);


  if (!channelSnipes) {
    channelSnipes = [];

    snipeCache.set(
      message.channelId,
      channelSnipes
    );
  }


  // ----------------------------------------------------------
  // ADD NEWEST MESSAGE FIRST
  // ----------------------------------------------------------

  channelSnipes.unshift(entry);


  // ----------------------------------------------------------
  // LIMIT TO 100
  // ----------------------------------------------------------

  if (
    channelSnipes.length >
    MAX_SNIPES_PER_CHANNEL
  ) {
    channelSnipes.length =
      MAX_SNIPES_PER_CHANNEL;
  }


  // ----------------------------------------------------------
  // REMOVE EXPIRED ENTRIES
  // ----------------------------------------------------------

  cleanupChannel(message.channelId);
}


// ============================================================
// CLEAN CHANNEL CACHE
// ============================================================

function cleanupChannel(channelId) {
  const channelSnipes =
    snipeCache.get(channelId);

  if (!channelSnipes) {
    return;
  }


  const cutoff =
    Date.now() -
    MAX_SNIPE_AGE;


  const filtered =
    channelSnipes.filter(
      (entry) =>
        entry.deletedTimestamp >= cutoff
    );


  if (filtered.length === 0) {
    snipeCache.delete(channelId);
    return;
  }


  snipeCache.set(
    channelId,
    filtered
  );
}


// ============================================================
// CLEAN ENTIRE CACHE
// ============================================================

function cleanupAllChannels() {
  const cutoff =
    Date.now() -
    MAX_SNIPE_AGE;


  for (
    const [channelId, entries]
    of snipeCache
  ) {
    const filtered =
      entries.filter(
        (entry) =>
          entry.deletedTimestamp >= cutoff
      );


    if (filtered.length === 0) {
      snipeCache.delete(channelId);
    } else {
      snipeCache.set(
        channelId,
        filtered
      );
    }
  }
}


// ============================================================
// GET SNIPE
// ============================================================

function getSnipe(
  channelId,
  number = 1
) {
  cleanupChannel(channelId);


  const channelSnipes =
    snipeCache.get(channelId);


  if (
    !channelSnipes ||
    channelSnipes.length === 0
  ) {
    return null;
  }


  const index =
    number - 1;


  if (
    index < 0 ||
    index >= channelSnipes.length
  ) {
    return null;
  }


  return channelSnipes[index];
}


// ============================================================
// NUMBER OF AVAILABLE SNIPES
// ============================================================

function getSnipeCount(channelId) {
  cleanupChannel(channelId);

  return (
    snipeCache.get(channelId)?.length ??
    0
  );
}


// ============================================================
// CLEAR CHANNEL
// ============================================================

function clearChannel(channelId) {
  snipeCache.delete(channelId);
}


// ============================================================
// CLEAR EVERYTHING
// ============================================================

function clearAll() {
  snipeCache.clear();
}


// ============================================================
// DISCORD TIMESTAMP
// ============================================================

function discordTimestamp(timestamp) {
  const unix =
    Math.floor(timestamp / 1000);

  return `<t:${unix}:R>`;
}


// ============================================================
// BUILD SNIPE EMBED
// ============================================================

function buildSnipeEmbed(
  entry,
  number
) {
  let content =
    entry.content?.trim();


  // ----------------------------------------------------------
  // EMPTY CONTENT
  // ----------------------------------------------------------

  if (!content) {
    content =
      "*No text content*";
  }


  // ----------------------------------------------------------
  // CONTENT LIMIT
  // ----------------------------------------------------------

  if (
    content.length >
    MAX_CONTENT_LENGTH
  ) {
    content =
      content.slice(
        0,
        MAX_CONTENT_LENGTH - 3
      ) +
      "...";
  }


  const embed =
    new EmbedBuilder()
      .setTitle(
        `Deleted Message #${number}`
      )

      .setDescription(
        content
      )

      .setAuthor({
        name:
          entry.author.username,

        iconURL:
          entry.author.avatarURL ??
          undefined,
      })

      .addFields(
        {
          name: "Author",

          value:
            entry.author.id
              ? `<@${entry.author.id}>`
              : entry.author.username,

          inline: true,
        },

        {
          name: "Sent",

          value:
            discordTimestamp(
              entry.createdTimestamp
            ),

          inline: true,
        },

        {
          name: "Deleted",

          value:
            discordTimestamp(
              entry.deletedTimestamp
            ),

          inline: true,
        }
      )

      .setFooter({
        text:
          `Snipe ${number} • ` +
          `Message ID: ${entry.id ?? "Unknown"}`,
      })

      .setTimestamp(
        entry.deletedTimestamp
      );


  // ==========================================================
  // IMAGE ATTACHMENT
  // ==========================================================

  const imageAttachment =
    entry.attachments.find(
      (attachment) =>
        attachment.contentType
          ?.startsWith("image/")
    );


  if (imageAttachment) {
    embed.setImage(
      imageAttachment.url
    );
  }


  // ==========================================================
  // ATTACHMENT LIST
  // ==========================================================

  if (
    entry.attachments.length > 0
  ) {
    const attachmentText =
      entry.attachments
        .slice(0, 10)
        .map(
          (attachment, index) =>
            `[${attachment.name || `Attachment ${index + 1}`}](${attachment.url})`
        )
        .join("\n");


    embed.addFields({
      name:
        `Attachments (${entry.attachments.length})`,

      value:
        attachmentText.slice(
          0,
          1024
        ),
    });
  }


  // ==========================================================
  // ATTACHMENT-ONLY MESSAGE
  // ==========================================================

  if (
    !entry.content?.trim() &&
    entry.attachments.length > 0
  ) {
    embed.setDescription(
      `*Deleted message contained ${entry.attachments.length} attachment(s).*`
    );
  }


  return embed;
}


// ============================================================
// INSTALL DELETE LISTENERS
// ============================================================
//
// This is protected so the listeners are only installed once.
//
// ============================================================

function installDeleteListeners(client) {
  if (!client) {
    return;
  }


  if (
    client.__megaTestSnipeInstalled
  ) {
    return;
  }


  client.__megaTestSnipeInstalled =
    true;


  // ==========================================================
  // NORMAL DELETE
  // ==========================================================

  client.on(
    "messageDelete",
    (message) => {
      try {
        addSnipe(message);
      } catch (error) {
        console.error(
          "[SNIPE] Failed to cache deleted message:",
          error
        );
      }
    }
  );


  // ==========================================================
  // BULK DELETE
  // ==========================================================

  client.on(
    "messageDeleteBulk",
    (messages) => {
      try {
        /*
         * Discord.js supplies a Collection here.
         *
         * Store every deleted message.
         */

        for (
          const message
          of messages.values()
        ) {
          addSnipe(message);
        }
      } catch (error) {
        console.error(
          "[SNIPE] Failed to cache bulk deleted messages:",
          error
        );
      }
    }
  );
}


// ============================================================
// PREFIX COMMAND
// ============================================================

async function handlePrefixSnipe(
  message,
  client
) {
  if (!message) {
    return false;
  }


  // ----------------------------------------------------------
  // IGNORE BOTS
  // ----------------------------------------------------------

  if (
    message.author?.bot
  ) {
    return false;
  }


  // Make sure listeners exist.
  installDeleteListeners(client);


  const content =
    message.content?.trim();


  if (!content) {
    return false;
  }


  const parts =
    content.split(/\s+/);


  const command =
    parts[0].toLowerCase();


  // ==========================================================
  // !SNIPE CLEAR
  // ==========================================================

  if (
    command ===
    `${PREFIX}snipe`.toLowerCase() &&
    parts[1]?.toLowerCase() ===
    "clear"
  ) {
    clearChannel(
      message.channelId
    );


    await message.reply({
      content:
        "✅ Snipe history for this channel has been cleared.",

      allowedMentions: {
        parse: [],
      },
    });


    return true;
  }


  // ==========================================================
  // !SNIPE
  // ==========================================================

  if (
    command !==
    `${PREFIX}snipe`.toLowerCase()
  ) {
    return false;
  }


  let number = 1;


  // ----------------------------------------------------------
  // PARSE NUMBER
  // ----------------------------------------------------------

  if (
    parts[1] !== undefined
  ) {
    if (
      !/^\d+$/.test(parts[1])
    ) {
      await message.reply({
        content:
          "❌ Please provide a valid number.\nExample: `!snipe 2`",

        allowedMentions: {
          parse: [],
        },
      });


      return true;
    }


    number =
      Number(parts[1]);
  }


  // ----------------------------------------------------------
  // VALIDATE NUMBER
  // ----------------------------------------------------------

  if (
    !Number.isSafeInteger(number) ||
    number < 1
  ) {
    await message.reply({
      content:
        "❌ The snipe number must be at least `1`.",

      allowedMentions: {
        parse: [],
      },
    });


    return true;
  }


  if (
    number >
    MAX_SNIPES_PER_CHANNEL
  ) {
    await message.reply({
      content:
        `❌ You can only snipe up to ${MAX_SNIPES_PER_CHANNEL} deleted messages.`,

      allowedMentions: {
        parse: [],
      },
    });


    return true;
  }


  // ----------------------------------------------------------
  // GET MESSAGE
  // ----------------------------------------------------------

  const entry =
    getSnipe(
      message.channelId,
      number
    );


  if (!entry) {
    const count =
      getSnipeCount(
        message.channelId
      );


    await message.reply({
      content:
        count === 0
          ? "❌ There are no recently deleted messages in this channel."
          : `❌ Only ${count} deleted message${count === 1 ? "" : "s"} available in this channel.`,

      allowedMentions: {
        parse: [],
      },
    });


    return true;
  }


  // ----------------------------------------------------------
  // DISPLAY
  // ----------------------------------------------------------

  const embed =
    buildSnipeEmbed(
      entry,
      number
    );


  await message.reply({
    embeds: [embed],

    allowedMentions: {
      parse: [],
    },
  });


  return true;
}


// ============================================================
// CLEANUP TIMER
// ============================================================

const cleanupTimer =
  setInterval(
    () => {
      try {
        cleanupAllChannels();
      } catch (error) {
        console.error(
          "[SNIPE] Cleanup error:",
          error
        );
      }
    },
    10 * 60 * 1000
  );


/*
 * Prevent the cleanup timer from keeping
 * the Node.js process alive.
 */
cleanupTimer.unref?.();


// ============================================================
// EXPORT
// ============================================================

export default {

  // ==========================================================
  // SLASH COMMAND
  // ==========================================================

  data:
    new SlashCommandBuilder()
      .setName("snipe")

      .setDescription(
        "Shows deleted messages"
      )

      // ------------------------------------------------------
      // /snipe when:2
      // ------------------------------------------------------

      .addIntegerOption(
        (option) =>
          option
            .setName("when")

            .setDescription(
              "Type a number (eg- 2 for the second recent deleted message and 3 for third and so on..)"
            )

            .setRequired(false)

            .setMinValue(1)

            .setMaxValue(
              MAX_SNIPES_PER_CHANNEL
            )
      )

      // ------------------------------------------------------
      // /snipe clear
      // ------------------------------------------------------

      .addSubcommand(
        (subcommand) =>
          subcommand
            .setName("clear")

            .setDescription(
              "Clear deleted message history for this channel"
            )
      ),


  category:
    "moderation",


  // ==========================================================
  // SLASH EXECUTE
  // ==========================================================

  async execute(
    interaction,
    config,
    client
  ) {
    installDeleteListeners(client);


    // ========================================================
    // /snipe clear
    // ========================================================

    const subcommand =
      interaction.options.getSubcommand(
        false
      );


    if (
      subcommand === "clear"
    ) {
      clearChannel(
        interaction.channelId
      );


      await interaction.reply({
        content:
          "✅ Snipe history for this channel has been cleared.",

        flags:
          MessageFlags.Ephemeral,
      });


      return;
    }


    // ========================================================
    // /snipe
    // ========================================================

    const number =
      interaction.options.getInteger(
        "when"
      ) ?? 1;


    // ========================================================
    // GET SNIPE
    // ========================================================

    const entry =
      getSnipe(
        interaction.channelId,
        number
      );


    if (!entry) {
      const count =
        getSnipeCount(
          interaction.channelId
        );


      await interaction.reply({
        content:
          count === 0
            ? "❌ There are no recently deleted messages in this channel."
            : `❌ Only ${count} deleted message${count === 1 ? "" : "s"} available in this channel.`,

        flags:
          MessageFlags.Ephemeral,
  
