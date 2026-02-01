import {App, PluginSettingTab} from "obsidian";
import KcalPlugin from "./main";

export interface KcalSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: KcalSettings = {
	mySetting: 'default'
}

export class KcalSettingsTab extends PluginSettingTab {
	plugin: KcalPlugin;

	constructor(app: App, plugin: KcalPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
	}
}
