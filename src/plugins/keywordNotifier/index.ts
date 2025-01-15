/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Notices } from "@api/index";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, GuildStore, NavigationRouter, UserStore } from "@webpack/common";
import { MessageJSON } from "discord-types/general";

interface MessageContext {
    channelId: string;
    guildId: string;
    isPushNotification: boolean;
    message: MessageJSON;
    optimistic: boolean;
    type: string;
}

interface NotificationOptions {
    author: {
        id: string;
        username: string;
        discriminator: string;
        avatarUrl: string;
    };
    keyword: string;
    guildId: string;
    channelId: string;
    message: {
        id: string;
        content: string;
    };
}

const settings = definePluginSettings({
    keywords: {
        type: OptionType.STRING,
        description: "Comma-separated list of keywords to watch for",
        default: ""
    },
    notifications: {
        type: OptionType.SELECT,
        description: "How to notify you when a keyword is found",
        options: [
            { label: "In-App Notice", value: "inApp" },
            { label: "Desktop Notification", value: "desktop" },
            { label: "In-App & Desktop Notifications", value: "both", default: true },
        ],
    },
    allowedGuilds: {
        type: OptionType.STRING,
        description: "Comma-separated list of guild IDs where to watch for the keywords",
        default: ""
    },
    allowedChannels: {
        type: OptionType.STRING,
        description: "Comma-separated list of channel IDs where to watch for the keywords",
        default: ""
    },
    ignoredGuilds: {
        type: OptionType.STRING,
        description: "Comma-separated list of guild IDs where to not watch for the keywords",
        default: ""
    },
    ignoredChannels: {
        type: OptionType.STRING,
        description: "Comma-separated list of channel IDs where to not watch for the keywords",
        default: ""
    },
    ignoredUsers: {
        type: OptionType.STRING,
        description: "Comma-separated list of user IDs to ignore",
        default: ""
    },
    ignoreBots: {
        type: OptionType.BOOLEAN,
        description: "Ignore messages from bots",
        default: false
    },
    ignoreMentions: {
        type: OptionType.BOOLEAN,
        description: "Ignore messages that mention you",
        default: true
    }
});

function getUserTag(username: string, discriminator: string) {
    return `${username}${discriminator !== "0" ? `#${discriminator}` : ""}`;
}

function getUserAvatarUrl(userId: string, avatar: string) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function Notify(options: NotificationOptions) {
    var { author, keyword, guildId, channelId, message } = options;

    if (settings.store.notifications === "inApp" || settings.store.notifications === "both") {
        Notices.showNotice(
            `@${getUserTag(author.username, author.discriminator)} mentioned "${keyword}" in ${GuildStore.getGuild(guildId)?.name}`,
            "Go To Message",
            () => {
                NavigationRouter.transitionTo(`/channels/${guildId}/${channelId}/${message.id}`);
                Notices.popNotice();
            }
        );
    }

    if (settings.store.notifications === "desktop" || settings.store.notifications === "both") {
        showNotification({
            title: `${author.username} (#${ChannelStore.getChannel(channelId)?.name}, ${GuildStore.getGuild(guildId)?.name})`,
            body: `${message.content}`,
            icon: author.avatarUrl,
            onClick: () => {
                NavigationRouter.transitionTo(`/channels/${guildId}/${channelId}/${message.id}`);
            }
        });
    }
}

function onMessageCreate(ctx: MessageContext) {
    if (!ctx.guildId) return;
    if (ctx.isPushNotification) return;

    var currentUser = UserStore.getCurrentUser();
    var currentChannel = getCurrentChannel();

    if (settings.store.ignoreMentions && ctx.message.mentions.some(mention => mention.id === currentUser?.id)) return;
    if (ctx.message.author.id === currentUser?.id) return;
    if (ctx.channelId === currentChannel?.id) return;

    var allowedGuilds = settings.store.allowedGuilds.length > 0 ? settings.store.allowedGuilds.split(",").map(id => id.trim()) : [];
    var allowedChannels = settings.store.allowedChannels.length > 0 ? settings.store.allowedChannels.split(",").map(id => id.trim()) : [];
    var ignoredGuilds = settings.store.ignoredGuilds.length > 0 ? settings.store.ignoredGuilds.split(",").map(id => id.trim()) : [];
    var ignoredChannels = settings.store.ignoredChannels.length > 0 ? settings.store.ignoredChannels.split(",").map(id => id.trim()) : [];
    var ignoredUsers = settings.store.ignoredUsers.length > 0 ? settings.store.ignoredUsers.split(",").map(id => id.trim()) : [];

    if ((allowedGuilds.length > 0 && !allowedGuilds.includes(ctx.guildId)) && (allowedChannels.length > 0 && !allowedChannels.includes(ctx.channelId))) return;

    if (ignoredGuilds.includes(ctx.guildId)) return;
    if (ignoredChannels.includes(ctx.channelId)) return;
    if (ignoredUsers.includes(ctx.message.author.id)) return;

    if (settings.store.ignoreBots && UserStore.getUser(ctx.message.author.id)?.bot) return;

    var keywords = settings.store.keywords.split(",").map(keyword => keyword.trim().toLowerCase());
    for (var keyword of keywords) {
        if (keyword.length > 0 && ctx.message.content.toLowerCase().includes(keyword)) {
            var options = {
                author: {
                    id: ctx.message.author.id,
                    username: ctx.message.author.username,
                    discriminator: ctx.message.author.discriminator,
                    avatarUrl: getUserAvatarUrl(ctx.message.author.id, ctx.message.author.avatar)
                },
                keyword,
                guildId: ctx.guildId,
                channelId: ctx.channelId,
                message: {
                    id: ctx.message.id,
                    content: ctx.message.content
                }
            };

            Notify(options);
            break;
        }
    }
}

export default definePlugin({
    name: "KeywordNotifier",
    description: "Get notified when a message contains a keyword",
    authors: [Devs.Kewi],
    settings,

    flux: {
        MESSAGE_CREATE: onMessageCreate,
    },
});
