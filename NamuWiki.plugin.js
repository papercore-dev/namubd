/**
 * @name NamuWiki
 * @author Papercore
 * @updateUrl https://raw.githubusercontent.com/papercore-dev/namubd/blob/main/NamuWiki.plugin.js
 * @authorLink https://github.com/papercore-dev
 * @source https://github.com/papercore-dev/namubd/blob/main/NamuWiki.plugin.js
 */
const config = {
	"info": {
		"name": "NamuWiki",
		"authors": [{
			"name": "sans2222",
			"discord_id": "897087746575851520",
			"github_username": "papercore-dev"
		}],
		"version": "1.0.1",
		"description": "Shows word's description from Namu Wiki.",
		"github_raw": "https://raw.githubusercontent.com/papercore-dev/namubd/blob/main/NamuWiki.plugin.js"
	},
}
module.exports = !global.ZeresPluginLibrary ? class {
	constructor() { this._config = config; }
	getName() { return config.info.name; }
	getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
	getDescription() { return config.info.description; }
	getVersion() { return config.info.version; }
	load() {
		BdApi.showConfirmationModal("라이브러리가 없습니다", `**${config.info.name}**을 실행하기 위한 라이브러리가 없습니다. 클릭하여 설치하세요.`, {
			confirmText: "지금 다운로드",
			cancelText: "취소",
			onConfirm: () => {
				require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
					if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
					await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
				});
			}
		});
	}
	start() { }
	stop() { }
} : (([Plugin, Library]) => {
	const customCSS = `
	.UrbanD-Word {
		clear: left;
		color: var(--header-primary);
		font-size: 1.3em;
		text-align: center;
		font-weight: bold;
		text-decoration: underline;
	}
	.UrbanD-Title {
		font-weight: 600;
		color: var(--text-normal);
		font-size: 1.1em;
	}
	.UrbanD-Text {
		color: var(--text-normal);
		padding-bottom: 15px;
	}
	.UrbanD-Image {
		float: left;
		margin-bottom: 30;
	}
	.UrbanD-Info {
		color: var(--text-normal);
		font-size: 0.9em;
		padding-top: 15px;
	}
	.UrbanD-Likes {
		font-weight: bold;
	}
	.UrbanD-Author {
		font-weight: bold;
	}
	.UrbanD-Date {
		color: var(--text-muted);
		font-size: 0.8em;
	}
	.UrbanD-Wrapper {
		-webkit-user-select: text;
	}
	.UrbanD-Definition {
		background-color: var(--background-secondary);
		border-radius: 15px;
		padding: 10px;
		margin-top: 20px;
	}
	`
	const { Toasts, WebpackModules, DCM, Patcher, React, Settings } = { ...Library, ...BdApi };
	const { SettingPanel, Switch, Slider, RadioGroup } = Settings;

	const MessageContextMenu = WebpackModules.getModule(m => m?.default?.displayName === "MessageContextMenu")
	const SlateTextAreaContextMenu = WebpackModules.getModule(m => m?.default?.displayName === "SlateTextAreaContextMenu")

	let profanityArray = [];

	const profanityOptions = [
		{
			name: '없음',
			desc: '욕설을 감지하지 않습니다.',
			value: 0
		},
		{
			name: '한국어 욕설 (권장)',
			desc: 'https://raw.githubusercontent.com/papercore-dev/stopabuse/main/lang.json 에서 약 530건의 한국어 및 영어 욕설을 가져옵니다.',
			value: 1
		},
		{
			name: '영어 욕설',
			desc: 'https://raw.githubusercontent.com/zacanger/profane-words/master/words.json 에서 영어 욕설을 가져옵니다.',
			value: 2
		},
		{
			name: '외부 API',
			desc: `https://www.purgomalum.com/ 의 API를 이용합니다. 컴퓨터 내에서 작동하는 것이 아닌 웹사이트에 접속하는 것이므로 검열의 가능성이 있습니다.`,
			value: 3
		}
	]
	return class UrbanDictionary extends Plugin {
		async onStart() {
			this.settings = this.loadSettings({ profanity: true, showAmount: 4, filter: 2 });
			profanityArray = await this.updateProfanityArray(this.settings.filter);

			BdApi.injectCSS(config.info.name, customCSS)

			Patcher.after(config.info.name, MessageContextMenu, "default", (_, __, ret) => {
				ret.props.children.push(this.getContextMenuItem())
			})

			Patcher.after(config.info.name, SlateTextAreaContextMenu, "default", (_, __, ret) => {
				ret.props.children.push(this.getContextMenuItem())
			})
		}
		getContextMenuItem() {
			let selection = window.getSelection().toString().trim();
			if (selection === "") { return; }
			let word = selection.charAt(0).toUpperCase() + selection.slice(1);

			let ContextMenuItem = DCM.buildMenuItem({
				label: "나무위키",
				type: "text",
				action: () => {
					fetch(`https://customsearch.googleapis.com/customsearch/v1?cx=60acbb412776540d2&filter=1&gl=kr&googlehost=google.co.kr&highRange=10&hl=ko&lr=lang_ko&safe=medium&siteSearch=%5C&key=AIzaSyAm_pg7vDtMoX_e_HKuv6WvXPThLlB3GiE&q=${word.toLocaleLowerCase()}`)
						.then(data => { return data.json() })
						.then(res => {
							this.processDefinitions(word, res);
						})
				}
			})
			return ContextMenuItem;

		}
		async processDefinitions(word, res) {
			if (this.settings.filter !== 0) {
				let wordHasProfanity = await this.containsProfanity(word);
				if (wordHasProfanity) {
					BdApi.alert("욕설이 포함되어 있어요!", "욕설 필터를 꺼서 단어의 뜻을 확인하세요.");
					return;
				}
			}

			if (res?.items?.length === 0) {
				BdApi.alert("뜻이 없어요!", React.createElement("div", { class: "markdown-11q6EU paragraph-3Ejjt0" }, `단어 `, React.createElement("span", { style: { fontWeight: "bold" } }, `"${word}"`), `을(를) 나무위키에서 찾을 수 없어요.`));//
				return;
			}

			let definitionElement = [];
			for (let i = 0; i < res.items.length && i < this.settings.showAmount; i++) {
				let definitionBlob = res.items[i];
                                let title = definitionBlob.title.replace(/[\[\]]/g, "");
				let definition = definitionBlob.snippet.replace(/[\[\]]/g, "");
				if (this.settings.filter !== 0) {
					definition = await this.filterText(definition);
					title = await this.filterText(title);
				}

				definitionElement.push(React.createElement("div", { class: "UrbanD-Definition" },
					React.createElement("div", { class: "UrbanD-Title" }, title),
					React.createElement("div", { class: "UrbanD-Text" }, definition),
				))
			}

			BdApi.alert("",
				React.createElement("div", { class: "UrbanD-Wrapper" },
					React.createElement("a", { href: "https://namu.wiki/", target: "_blank" }, React.createElement("img", { class: "UrbanD-Image", src: "https://gist.githubusercontent.com/papercore-dev/710014d8166ef2c701187555ef8780ba/raw/b0b42a3f17f29d9f652885ee2687a96fb37e13f9/namu.svg", width: "100" }),),
					React.createElement("a", { href: `https://namu.wiki/w/${word}`, target: "_blank" }, React.createElement("div", { class: "UrbanD-Word" }, word)),
					definitionElement
				)
			)
		}
		async containsProfanity(text) {
			if (this.settings.filter === 3) {
				return await fetch(`https://www.purgomalum.com/service/containsprofanity?text=${text}`)
					.then(data => {
						return data.json()
					})
					.then(res => {
						return res;
					})
			}

			text = text.toLowerCase()
			let wordArray = text.match(/\w+/gi);
			let hasProfanity = false;
			wordArray.forEach(text => {
				if(profanityArray.includes(text)) {
					hasProfanity = true;
				}
			})
			return hasProfanity;
		}
		async filterText(text) {
			if (this.settings.filter === 3) {
				return await fetch(`https://www.purgomalum.com/service/plain?text=${text}`)
					.then(data => {
						return data.text()
					})
					.then(res => {
						return res;
					})
			}
			let wordArray = text.match(/\w+/gi);
			let newText = text;
			wordArray.forEach(word => {
				if(profanityArray.includes(word.toLowerCase())) {
					newText = newText.replace(word, "*".repeat(word.length));
				}
			})
			return newText;
		}
		async updateProfanityArray(option) {
			let url;
			switch (option) {
				case 3: case 0:
					profanityArray = [];
					return;
				case 1:
					url = "https://raw.githubusercontent.com/papercore-dev/stopabuse/main/lang.json";
					break;
				case 2:
					url = "https://raw.githubusercontent.com/zacanger/profane-words/master/words.json";
					break;
			}
			fetch(url)
				.then(data => {
					return data.json()
				})
				.then(res => {
					profanityArray = res.words ? res.words : res;
				})
		}
		getSettingsPanel() {
			return SettingPanel.build(() => this.saveSettings(this.settings),
				new RadioGroup('필터링', `욕설 필터를 켜려면 클릭하세요. 검색 결과가 나타나기까지 시간이 걸릴 수 있습니다. 완벽한 필터는 없고, 미성년자에게 적절하지 못한 주제가 나타날 수 있습니다.`, this.settings.filter || 0, profanityOptions, (i) => {
					this.settings.filter = i;
					profanityArray = this.updateProfanityArray(i);
				}),
				new Slider("결과 수", "몇개의 결과를 나타낼지 선택하세요.", 1, 10, this.settings.showAmount, (i) => {
					this.settings.showAmount = i;
				}, { markers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], stickToMarkers: true }),
			)

		}
		onStop() {
			BdApi.clearCSS(config.info.name)
			Patcher.unpatchAll(config.info.name);
		}

	}
})(global.ZeresPluginLibrary.buildPlugin(config));
