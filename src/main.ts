import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, KcalSettings, KcalSettingsTab, } from "./settings";
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

export default class KcalPlugin extends Plugin {
	settings: KcalSettings;

	async onload() {
		await this.loadSettings();
		this.registerEditorExtension(kcalListPlugin);
		this.addSettingTab(new KcalSettingsTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<KcalSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class KcalListPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}
	update(update: ViewUpdate): void {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}
	buildDecorations(view: EditorView): DecorationSet {
		const builder: Array<Range<Decoration>> = [];
		for (let { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from, to, enter(node) {
					if (!node.type.name.startsWith('inline-code')) return // ??? startsWith??? insanity
					const text = view.state.doc.sliceString(node.from, node.to);
					if (!text.startsWith("FOOD:")) return
					let totalKcal = 0
					for (const match of text.matchAll(foodRegex)) {
						const [span, qty, unt, knd, kcalOverride] = match;
						const core = span.trimEnd()
						const coreLength = core.length - (core.endsWith(",") ? 1 : 0)
						const parsed = parseFoodOnce(qty!, unt!, knd!, kcalOverride)
						const end = node.from + match.index + coreLength;

						if (parsed.mark)
							builder.push(parsed.mark.range(node.from + match.index, end))
						if (parsed.kcal) {
							builder.push(
								Decoration.widget({
									widget: new KcalWidget(parsed.kcal, false, end == node.to),
									side: 5
								}).range(end)
							)
							totalKcal += parsed.kcal
						}
					}
					builder.push(Decoration.widget({
						widget: new KcalWidget(totalKcal, true, true),
						side: 20
					}).range(node.to))
				}
			})
		}
		builder.sort((a, b) => (a.from - b.from) || (a.value.startSide - b.value.startSide))
		return Decoration.set(builder);
	}
}

function parseFoodOnce(quantityStr: string, unit: string, kind: string, kcalOverride: string | undefined): { mark: Decoration | undefined } & ({
	grams?: number,
	kcal?: number
}) {
	const kcalOverrideParsed = parseFloat(kcalOverride ?? "");
	if (kcalOverride) return {
		mark: Decoration.mark({
			class: "food-underline-parsed"
		}),
		kcal: kcalOverrideParsed,
	}

	const quantity = parseFloat(quantityStr)
	if (!quantity) return { mark: Decoration.mark({ class: "food-underline-error" }) }

	const unitKey = unit.toLowerCase()

	if (unitKey == 'kcal') return {
		mark: Decoration.mark({
			class: "food-underline-parsed"
		}),
		kcal: quantity,
	}

	const foodData = foods[kind.replace("  +", " ").toLowerCase().trim()]
	if (!foodData) return { mark: Decoration.mark({ class: "food-underline-error" }) }

	const unitMultiplier = foodData.conversions?.[unitKey] ?? globalConversions[unitKey]
	if (!unitMultiplier) return { mark: Decoration.mark({ class: "food-underline-error" }) }

	const grams = quantity * unitMultiplier

	return {
		mark: Decoration.mark({
			class: "food-underline-parsed"
		}),
		kcal: grams / 100 * foodData.kcalPer100g,
		grams
	}
}
type Conversions = Record<string, number>
interface Food {
	kcalPer100g: number,
	conversions?: Conversions
}
const foods: Record<string, Food> = {
	'aldi hummus': { kcalPer100g: 307, },
	pretzel: {
		kcalPer100g: 276,
		conversions: { x: 80 }
	},
	gouda: { kcalPer100g: 350 },
	cheddar: { kcalPer100g: 400 },
	pasta: { kcalPer100g: 350 },
	parmesan: { kcalPer100g: 430 },
	feta: { kcalPer100g: 260 },
	'no butter': { kcalPer100g: 711 },
	'egg': {
		kcalPer100g: 143,
		conversions: {
			'x': 50
		},
	},
	'triangle potato': {
		kcalPer100g: 269 / 1.5,
		conversions: {
			x: 100 // TODO: check
		}
	},
	'ketchup': { kcalPer100g: 110 },
	'vegan nutella': {
		kcalPer100g: 534,
	},
	'raisin bread': {
		kcalPer100g: 313,
		conversions: {
			x: 60,
		},
	},
}
const globalConversions: Conversions = {
	mg: 0.001,
	kg: 1000,
	g: 1,
}

// fuck ios versions before 16.4
// eslint-disable-next-line obsidianmd/regex-lookbehind
const foodRegex = /(?<=[,:] *)([0-9]+(?:\.[0-9]+)?)([a-z]+) +([ a-zA-ZäÄüÜöÖß]+)(?:\(.*\b([0-9]+)kcal\b.*\) *)?($|,)/g;

class KcalWidget extends WidgetType {
	kcal: number
	total: boolean
	isFinal: boolean
	constructor(kcal: number, total: boolean, isFinal: boolean) {
		super()
		this.kcal = kcal
		this.isFinal = isFinal;
		this.total = total
	}
	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement("span");
		if (this.total) {
			div.classList.add("food-badge-total")
		} else {
			div.classList.add("food-badge-intermediary")
		}
		div.classList.add("food-badge")
		div.innerText = (this.total ? ' = ' : '') + `${this.kcal | 0} kcal`;
		const mDiv = document.createElement("span");
		mDiv.appendChild(div)
		if (this.isFinal)
			mDiv.classList.add("cm-formatting", "cm-inline-code")
		return mDiv
	}
}

export const kcalListPlugin = ViewPlugin.fromClass(
	KcalListPlugin,
	{
		decorations: value => value.decorations,
		provide: value => []
	}
);