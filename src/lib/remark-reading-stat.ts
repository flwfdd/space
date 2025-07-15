import { toString } from 'mdast-util-to-string';
import getReadingTime from 'reading-time';

export function remarkReadingTime() {
    return function (tree: any, { data }: any) {
        const textOnPage = toString(tree);
        const readingTime = getReadingTime(textOnPage);
        // readingTime.text 会以友好的字符串形式给出阅读时间，例如 "3 min read"。
        data.astro.frontmatter.readingMinutes = readingTime.minutes;
        data.astro.frontmatter.readingWords = readingTime.words;
        data.astro.frontmatter.readingText = readingTime.text;
        data.astro.frontmatter.readingTime = readingTime.time;
    };
}