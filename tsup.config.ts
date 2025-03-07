import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["./src/event-emitter.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	outDir: "dist",
	noExternal: [],
	external: [],
	esbuildOptions(options) {
		options.conditions = ["bun", "import"];
	},
});
