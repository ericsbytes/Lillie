import type { Client } from 'discord.js';
import { commandData } from '../commands';

export async function registerCommands(client: Client<true>) {
	const guilds = await client.guilds.fetch();

	if (guilds.size === 0) {
		console.log('No guilds available for command registration.');
		return;
	}

	for (const guildSummary of guilds.values()) {
		const guild = await client.guilds.fetch(guildSummary.id);
		await client.application.commands.set([]);
		await guild.commands.set(commandData);
		console.log(
			`Registered ${commandData.length} guild command(s) in ${guild.name}.`,
		);
	}
}
