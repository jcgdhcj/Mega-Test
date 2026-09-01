import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getLogChannel, EVENT_TYPES } from '../../services/loggingService.js';
import { snipeCache, clearSnipe } from '../../utils/snipeCache.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("View or clear deleted messages")
    // --- Subcommand: /snipe view ---
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("Shows deleted messages")
        .addIntegerOption((option) =>
          option
            .setName("when")
            .setDescription("Type a number (eg- 2 for second recent, 3 for third, etc.)")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
    )
    // --- Subcommand: /snipe clear ---
    .addSubcommand((subcommand) =>
      subcommand
        .setName("clear")
        .setDescription("Clear the snipe history for this channel")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  category: "utility",

  // --- SLASH COMMAND EXECUTION ---
  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, {
      flags: MessageFlags.Ephemeral,
    });
    if (!deferSuccess) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "clear") {
      clearSnipe(interaction.channel.id);
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed("Snipe Cleared", `The snipe history for ${interaction.channel} has been cleared.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Default: View subcommand
    const index = interaction.options.getInteger("when") ?? 1;
    const embed = await getSnipeEmbed(client, interaction.guild, interaction.channel, index);

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },

  // --- PREFIX COMMAND EXECUTION (!snipe or !snipe clear) ---
  async runPrefix(message, args) {
    if (args[0]?.toLowerCase() === "clear") {
      // Ensure user has Manage Messages permission for clearing
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply("You need `Manage Messages` permissions to clear the snipe history.");
      }

      clearSnipe(message.channel.id);
      return message.reply({
        embeds: [successEmbed("Snipe Cleared", `The snipe history for ${message.channel} has been cleared.`)]
      });
    }

    const parsedIndex = parseInt(args[0], 10);
    const index = !isNaN(parsedIndex) && parsedIndex > 0 ? parsedIndex : 1;

    const embed = await getSnipeEmbed(message.client, message.guild, message.channel, index);
    await message.reply({ embeds: [embed] });
  }
};

/**
 * Helper to fetch snipe content from Log Channel or RAM fallback.
 */
async function getSnipeEmbed(client, guild, targetChannel, position) {
  let logChannel = null;

  try {
    logChannel = await getLogChannel(client, guild.id, EVENT_TYPES.MESSAGE_DELETE);
  } catch (err) {
    // Logging channel lookup failed or not configured
  }

  // --- PATH A: Log Channel Configured ---
  if (logChannel) {
    try {
      const logs = await logChannel.messages.fetch({ limit: 100 });

      const channelLogs = logs.filter((msg) => {
        if (!msg.embeds.length) return false;
        const embed = msg.embeds[0];
        const isDeleteAction = embed.title?.toLowerCase().includes("message deleted");
        const isTargetChannel = 
          embed.description?.includes(targetChannel.id) ||
          embed.fields?.some((f) => f.value?.includes(targetChannel.id));

        return isDeleteAction && isTargetChannel;
      });

      const logsArray = Array.from(channelLogs.values());
      const arrayIndex = position - 1;

      if (logsArray.length === 0) {
        return errorEmbed("Nothing to Snipe", `No recently deleted messages found in logs for ${targetChannel}.`);
      }

      if (arrayIndex >= logsArray.length) {
        return errorEmbed("Snipe Out of Range", `Only **${logsArray.length}** deleted message(s) are logged for ${targetChannel}.`);
      }

      const logMsg = logsArray[arrayIndex];
      const logEmbed = logMsg.embeds[0];
      const msgSection = logEmbed.fields?.find((f) => f.name === "Message" || f.name === "Content");
      const content = msgSection ? msgSection.value : (logEmbed.description || "*[No text content]*");

      const embed = createEmbed()
        .setAuthor({
          name: logEmbed.author?.name || "Deleted Message",
          iconURL: logEmbed.author?.iconURL
        })
        .setDescription(content)
        .addFields(
          { name: "Source", value: "Mod Log Channel", inline: true },
          { name: "Position", value: `#${position} of ${logsArray.length}`, inline: true }
        )
        .setFooter({ text: `Requested position #${position}` })
        .setTimestamp(logMsg.createdAt);

      if (logEmbed.image) embed.setImage(logEmbed.image.url);

      return embed;
    } catch (error) {
      // Fallback to RAM cache
    }
  }

  // --- PATH B: Fallback to RAM Cache ---
  const channelSnipes = snipeCache.get(targetChannel.id);

  if (!channelSnipes || channelSnipes.length === 0) {
    return errorEmbed("Nothing to Snipe", "No recently deleted messages found in memory.");
  }

  const arrayIndex = position - 1;

  if (arrayIndex >= channelSnipes.length) {
    return errorEmbed("Snipe Out of Range", `Only the last **${channelSnipes.length}** deleted message(s) are stored in memory for this channel.`);
  }

  const target = channelSnipes[arrayIndex];
  const timestamp = Math.floor(target.deletedAt.getTime() / 1000);

  const embed = createEmbed()
    .setAuthor({
      name: target.authorTag,
      iconURL: target.authorAvatar,
    })
    .setDescription(target.content || "*[No text content — likely an image/embed]*")
    .addFields(
      { name: "Deleted", value: `<t:${timestamp}:R>`, inline: true },
      { name: "Position", value: `#${position} of ${channelSnipes.length}`, inline: true }
    )
    .setFooter({ text: `Requested message position #${position}` })
    .setTimestamp(target.createdAt);

  if (target.attachment) {
    embed.setImage(target.attachment);
  }

  return embed;
          }
                                      
