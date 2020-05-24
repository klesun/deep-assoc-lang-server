import Psi, { Opt } from "deep-assoc-lang-server/src/helpers/Psi";
import { Phrase, PhraseType, TokenType } from "php7parser";
import { Type } from "deep-assoc-lang-server/src/structures/Type";
import PsalmTypeExprParser from "deep-assoc-lang-server/src/structures/psalm/PsalmTypeExprParser";
import Log from "deep-assoc-lang-server/src/Log";

/** removes stars */
const getDocCommentText = (docCommentToken: string): Opt<string> => {
    const match = docCommentToken.match(/^\/\*\**(?:\s*)(.*)\*\/$/s);
    if (!match) {
        return [];
    } else {
        const clean = match[1].split('\n')
            .map(l => l.replace(/^\s*\*\s?/, ''))
            .join('\n');
        return [clean];
    }
};

interface RawDocTag {
    tagName: string;
    textLeft: string;
}

const getRawTags = (docText: string) => {
    const tags = [];
    let current: Opt<RawDocTag> = [];
    for (const line of docText.split('\n')) {
        const match = line.match(/^\s*@([\w\-]+)\s*(.*)/);
        if (match) {
            const [, tagName, textLeft] = match;
            tags.push(...current);
            current = [{tagName, textLeft}];
        } else if (current.length) {
            current = [{
                tagName: current[0].tagName,
                textLeft: current[0].textLeft + '\n' + line,
            }];
        }
    }
    tags.push(...current);
    return tags;
};

/**
 * note, returned types may be an IMt instance,
 * so you better call flattenTypes() right afterwards
 *
 * did not want putting flattening here, because there could
 * probably be other kinds of complex types than A|B, like A&B
 */
const PsalmFuncInfo = ({funcDeclPsi}: {
    funcDeclPsi: Psi<Phrase>,
}): Opt<{
    params: Record<string, Type>,
    returnType: Opt<Type>,
}> => {
    if (![PhraseType.FunctionDeclaration, PhraseType.MethodDeclaration].includes(funcDeclPsi.node.phraseType)) {
        return [];
    }
    const typedTags = funcDeclPsi
        .prevSibling(psi => !psi.asToken(TokenType.Whitespace).length)
        .flatMap(par => par.asToken(TokenType.DocumentComment))
        .flatMap(psi => getDocCommentText(psi.text()))
        .flatMap(getRawTags)
        .flatMap(rawTag => PsalmTypeExprParser(rawTag.textLeft)
            .map(parsed => ({...rawTag, ...parsed})));

    const params: Record<string, Type> = {};
    let returnType: Opt<Type> = [];
    for (const typedTag of typedTags) {
        if (['param', 'psalm-param'].includes(typedTag.tagName)) {
            const tagArgName = typedTag.textLeft.trim()
                .replace(/^\$(\w+).*/s, '$1');
            params[tagArgName] = typedTag.type;
        } else if (['return', 'psalm-return'].includes(typedTag.tagName)) {
            returnType = [typedTag.type];
        }
    }

    return [{params, returnType}];
};

export default PsalmFuncInfo;