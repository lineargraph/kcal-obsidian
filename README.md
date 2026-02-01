# Kcal Tracker.

Any inline code block in this form will be interpreted

```
`FOOD: <quantity><unit> <food kind> (<number>kcal), ...`
```

The parenthesis are optional (but required syntactically for comments that are not part of the food kind). All units and food kinds are hardcoded for now. kcal override in the parenthesis overrides everything.

Base unit is grams. Any kcals are annotated per 100g, then other units are derived either globalls (kg, mg), or locally for one specific food kind. x is customary for "one count".

```ts
const foods: Record<string, Food> = {
	feta: { kcalPer100g: 260 },
	'egg': {
		kcalPer100g: 143,
		conversions: {
			'x': 50
		},
	},
    // ...
}
```

Future TODO: add a special table that can be edited instead of having things in code.