import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import * as block from './block';
import * as leaderboard from './leaderboard';
import * as send from './send';

export type Command = {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
};

const commandList: Command[] = [send, block, leaderboard];

export const commands = new Map(
	commandList.map(command => [command.data.name, command]),
);

export const commandData = commandList.map(command => command.data.toJSON());
