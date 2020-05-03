import { Opt } from "deep-assoc-lang-server/src/helpers/Psi";

/**
 * @param {String} litText - escaped, like "somekey\t\\Ol\"olo"
 * @return {Opt<string>} - unescaped: somekey    \Ol"olo
 */
export const  unquote = (litText: string): Opt<string> => {
    if (litText.length < 2) {
        return []; // invalid format
    }
    const opening = litText[0];
    const ending = litText.slice(-1)[0];
    if (opening !== ending || !['\'', '"'].includes(opening)) {
        // lol, just googled what backticks do...
        return []; // invalid format
    }
    // TODO: implement
    //  you do not usually use special characters in key name, so skipping for now,
    //  since you anyway would want an escaped line break when completing a key name
    return [litText.slice(1, -1)];
};