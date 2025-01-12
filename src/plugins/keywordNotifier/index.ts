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
import { Message } from "discord-types/general";

interface MessageContext {
    channelId: string;
    guildId: string;
    isPushNotification: boolean;
    message: Message;
    optimistic: boolean;
    type: string;
}

interface NotificationOptions {
    author: {
        id: string;
        username: string;
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
    }
});

function getUserAvatarUrl(userId: string, avatar: string) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function Notify(options: NotificationOptions) {
    var { author, keyword, guildId, channelId, message } = options;

    if (settings.store.notifications === "inApp" || settings.store.notifications === "both") {
        Notices.showNotice(
            `@${author.username} mentioned "${keyword}" in ${GuildStore.getGuild(guildId)?.name}`,
            "Go To Message",
            () => {
                NavigationRouter.transitionTo(`/channels/${guildId}/${channelId}/${message.id}`);
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
    if (ctx.message.author.id === UserStore.getCurrentUser().id) return;
    if (ctx.channelId === getCurrentChannel()?.id) return;

    var allowedGuilds = settings.store.allowedChannels.split(",").map(id => id.trim());
    var allowedChannels = settings.store.allowedChannels.split(",").map(id => id.trim());
    var ignoredGuilds = settings.store.ignoredGuilds.split(",").map(id => id.trim());
    var ignoredChannels = settings.store.ignoredChannels.split(",").map(id => id.trim());
    var ignoredUsers = settings.store.ignoredUsers.split(",").map(id => id.trim());

    if (!allowedGuilds.includes(ctx.guildId)) return;
    if (!allowedChannels.includes(ctx.channelId)) return;

    if (ignoredGuilds.includes(ctx.guildId)) return;
    if (ignoredChannels.includes(ctx.channelId)) return;
    if (ignoredUsers.includes(ctx.message.author.id)) return;

    if (settings.store.ignoreBots && ctx.message.author.bot) return;

    var keywords = settings.store.keywords.split(",").map(keyword => keyword.trim().toLowerCase());
    for (var keyword of keywords) {
        if (keyword.length > 0 && ctx.message.content.toLowerCase().includes(keyword)) {
            var options = {
                author: {
                    id: ctx.message.author.id,
                    username: ctx.message.author.username,
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
