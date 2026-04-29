import i18next from 'i18next';
import zh from './zh.js'
import zhTw from './zh-tw.js'
import en from './en.js'
import app from '../hono/hono';

app.use('*', async (c, next) => {
	const lang = normalizeLang(c.req.header('accept-language'))
	i18next.init({
		lng: lang,
	});
	return await next()
})

const resources = {
	en: {
		translation: en
	},
	zh: {
		translation: zh,
	},
	'zh-tw': {
		translation: zhTw,
	},
};

i18next.init({
	fallbackLng: 'zh',
	resources,
});

export const t = (key, values) => i18next.t(key, values)

export default i18next;

function normalizeLang(acceptLanguage) {
	const lang = acceptLanguage?.split(',')[0]?.toLowerCase()
	if (['zh-tw', 'zh-hk', 'zh-mo'].includes(lang)) {
		return 'zh-tw'
	}
	if (lang?.startsWith('en')) {
		return 'en'
	}
	if (lang?.startsWith('zh')) {
		return 'zh'
	}
	return 'zh'
}
