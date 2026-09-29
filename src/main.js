import {
	createSSRApp
} from "vue";
import * as Pinia from "pinia";
import App from "./App.vue";

export function createApp() {
	const app = createSSRApp(App);
	app.use(Pinia.createPinia());
	return {
		app,
		// uni-app 要求把 Pinia 一并返回，否则小程序端拿不到实例
		Pinia,
	};
}
