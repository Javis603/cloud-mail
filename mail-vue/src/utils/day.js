import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/zh-tw'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {useSettingStore} from "@/store/setting.js";

const settingStore = useSettingStore();
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale(toDayjsLocale(settingStore.lang))

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function fromNow(date) {
    const d = dayjs.utc(date).tz(timeZone);
    const now = dayjs();
    const diffSeconds = now.diff(d, 'second');
    const diffMinutes = now.diff(d, 'minute');
    const diffHours = now.diff(d, 'hour');
    const isToday = now.isSame(d, 'day');

    if (settingStore.lang === 'en') {
        if (isToday) {
            if (diffSeconds < 60) return 'Just now';
            if (diffMinutes < 60) return `${diffMinutes} min ago`;
            if (diffHours < 2) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            return d.format('hh:mm A');
        }

        if (now.subtract(1, 'day').isSame(d, 'day')) {
            return d.format('MMM D');
        }

        return d.year() === now.year()
            ? d.format('MMM D')
            : d.format('YYYY/MM/DD');
    }

    const isTraditional = settingStore.lang === 'zh-tw';

    if (isToday) {
        if (diffSeconds < 60) return isTraditional ? '剛剛' : '刚刚';
        if (diffMinutes < 60) return `${diffMinutes}${isTraditional ? '分鐘前' : '分钟前'}`;
        if (diffHours >= 1 && diffHours < 2) return isTraditional ? '1 小時前' : '1 小时前';
        return d.format('HH:mm');
    }

    if (now.subtract(1, 'day').isSame(d, 'day')) {
        return `${isTraditional ? '昨天' : '昨天'} ${d.format('HH:mm')}`;
    }

    if (now.subtract(2, 'day').isSame(d, 'day')) {
        return `${isTraditional ? '前天' : '前天'} ${d.format('HH:mm')}`;
    }

    return d.year() === now.year()
        ? d.format('M月D日')
        : d.format('YYYY/M/D');
}

export function updateNow(date) {
    const d = dayjs.utc(date).tz(timeZone);
    const now = dayjs();
    const diffSeconds = now.diff(d, 'second');
    const diffMinutes = now.diff(d, 'minute');
    const diffHours = now.diff(d, 'hour');
    const isToday = now.isSame(d, 'day');

    if (isToday) {
        if (diffSeconds < 60) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} min ago`;
        if (diffHours < 2) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return d.format('hh:mm A');
    }
}

export function formatDetailDate(time) {
    const d = dayjs.utc(time).tz(timeZone);
    const now = dayjs();
    const isSameYear = now.year() === d.year();

    if (settingStore.lang === 'en') {
        return isSameYear
            ? d.format('ddd, MMM D, h:mm A')
            : d.format('ddd, MMM D, YYYY, h:mm A');
    }

    return d.format('YYYY年M月D日 ddd AH:mm');
}

export function tzDayjs(time) {
    return dayjs.utc(time).tz(timeZone)
}

export function toUtc(time) {
    return dayjs(time).utc()
}

export function setExtend(lang) {
    dayjs.locale(toDayjsLocale(lang))
}

function toDayjsLocale(lang) {
    if (lang === 'en') {
        return 'en'
    }
    if (lang === 'zh-tw') {
        return 'zh-tw'
    }
    return 'zh-cn'
}
