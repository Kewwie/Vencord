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
import { NavigationRouter, UserStore } from "@webpack/common";
import { Message } from "discord-types/general";

interface MessageContext {
    channelId: string;
    guildId: string;
    isPushNotification: boolean;
    message: Message;
    optimistic: boolean;
    type: string;
}

const settings = definePluginSettings({
    keywords: {
        type: OptionType.STRING,
        description: "Comma-separated list of keywords to watch for",
        default: ""
    },
    whitelists: {
        type: OptionType.SELECT,
        description: "Only watch for keywords in the specified whitelists",
        options: [
            { label: "None", value: "none", default: true },
            { label: "Guilds", value: "guild" },
            { label: "Channels", value: "channel" },
            { label: "Guilds & Channels", value: "guild-channel" },
        ],
    },
    guildWhitelist: {
        type: OptionType.STRING,
        description: "Comma-separated list of guild IDs where to watch for the keywords",
        default: ""
    },
    channelWhitelist: {
        type: OptionType.STRING,
        description: "Comma-separated list of channel IDs where to watch for the keywords",
        default: ""
    },
    blacklists: {
        type: OptionType.SELECT,
        description: "Don't watch for keywords from the specified blacklists",
        options: [
            { label: "None", value: "none", default: true },
            { label: "Guilds", value: "guild" },
            { label: "Channels", value: "channel" },
            { label: "Guilds & Channels", value: "guild-channel" },
        ],
    },
    guildBlacklist: {
        type: OptionType.STRING,
        description: "Comma-separated list of guild IDs where to not watch for the keywords",
        default: ""
    },
    channelBlackklist: {
        type: OptionType.STRING,
        description: "Comma-separated list of channel IDs where to not watch for the keywords",
        default: ""
    },
    notifications: {
        type: OptionType.SELECT,
        description: "How to notify you when a keyword is found",
        options: [
            { label: "In-App Notice", value: "inApp", default: true },
            { label: "Desktop Notification", value: "desktop" },
            { label: "Both", value: "both" },
        ],
    }
});

function Notify(ctx: MessageContext, keyword: string) {
    if (settings.store.notifications === "inApp" || settings.store.notifications === "both") {
        Notices.showNotice(
            `@${ctx.message.author.username} said something that included the keyword "${keyword}"`,
            "Go To Message",
            () => {
                NavigationRouter.transitionTo(`/channels/${ctx.guildId}/${ctx.channelId}/${ctx.message.id}`);
                Notices.popNotice();
            }
        );
    }

    if (settings.store.notifications === "desktop" || settings.store.notifications === "both") {
        showNotification({
            title: "Keyword Notifier",
            body: `@${ctx.message.author.username}: ${ctx.message.content}`,
            icon: ctx.message.author.avatar,
            onClick: () => {
                NavigationRouter.transitionTo(`/channels/${ctx.guildId}/${ctx.channelId}/${ctx.message.id}`);
            }
        });
    }
}

function onMessageCreate(ctx: MessageContext) {
    if (!ctx.guildId) return;
    if (ctx.isPushNotification) return;
    if (ctx.message.author.id === UserStore.getCurrentUser().id) return;
    if (ctx.channelId === getCurrentChannel()?.id) return;

    var allowedGuilds = settings.store.guildWhitelist.split(",").map(id => id.trim());
    var allowedChannels = settings.store.channelWhitelist.split(",").map(id => id.trim());
    var blockedGuilds = settings.store.guildBlacklist.split(",").map(id => id.trim());
    var blockedChannels = settings.store.channelBlackklist.split(",").map(id => id.trim());

    if (settings.store.whitelists !== "none") {
        if (settings.store.whitelists === "guild" && !allowedGuilds.includes(ctx.guildId)) return;
        if (settings.store.whitelists === "channel" && !allowedChannels.includes(ctx.channelId)) return;
        if (settings.store.whitelists === "guild-channel" && !allowedGuilds.includes(ctx.guildId) && !allowedChannels.includes(ctx.channelId)) return;
    }

    if (settings.store.blacklists !== "none") {
        if (settings.store.blacklists === "guild" && blockedGuilds.includes(ctx.guildId)) return;
        if (settings.store.blacklists === "channel" && blockedChannels.includes(ctx.channelId)) return;
        if (settings.store.blacklists === "guild-channel" && blockedGuilds.includes(ctx.guildId) && blockedChannels.includes(ctx.channelId)) return;
    }

    var keywords = settings.store.keywords.split(",").map(keyword => keyword.trim());
    for (var keyword of keywords) {
        if (keyword.length > 0 && ctx.message.content.includes(keyword)) Notify(ctx, keyword);
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
